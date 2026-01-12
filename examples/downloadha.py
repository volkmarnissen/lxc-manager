#!/usr/bin/env python3
"""
Example script to download Home Assistant OCI image from Docker Hub.

This script demonstrates how to use get-oci-image.py by replacing
template variables with concrete values and executing the script.
"""

import sys
import os
import subprocess
import re
from pathlib import Path

# Path to the get-oci-image.py script
SCRIPT_DIR = Path(__file__).parent.parent / "json" / "shared" / "scripts"
GET_OCI_IMAGE_SCRIPT = SCRIPT_DIR / "get-oci-image.py"

def replace_template_variables(script_content: str, replacements: dict) -> str:
    """
    Replace template variables {{ variable }} with actual values.
    Only replaces template variables in variable assignments, not in comparisons or other contexts.
    
    Args:
        script_content: The script content with template variables
        replacements: Dictionary mapping variable names to values
    """
    result = script_content
    for var_name, var_value in replacements.items():
        escaped_var_name = re.escape(var_name)
        
        if var_value is None:
            # If value is None, replace with empty string "" to avoid NoneType errors
            # Only replace in assignments: var_name = "{{ var_name }}" -> var_name = ""
            assignment_pattern = r'(\b' + escaped_var_name + r'\s*=\s*)"\{\{\s*' + escaped_var_name + r'\s*\}\}"'
            result = re.sub(assignment_pattern, r'\1""', result)
        else:
            # Only replace in variable assignments, not in comparisons or other contexts
            # Pattern: var_name = "{{ var_name }}" (with quotes in Python string assignment)
            # Use word boundary and = to ensure we match assignments, not comparisons
            assignment_pattern = r'(\b' + escaped_var_name + r'\s*=\s*)"\{\{\s*' + escaped_var_name + r'\s*\}\}"'
            escaped_value = str(var_value).replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            result = re.sub(assignment_pattern, rf'\1"{escaped_value}"', result)
    return result


def main():
    """Main function."""
    # Configuration for Home Assistant download
    config = {
        "oci_image": "docker://homeassistant/home-assistant:latest",
        "output_dir": os.path.expanduser("~/Downloads"),  # Local output directory
        # Optional: uncomment if you need authentication
        # "registry_username": None,
        # "registry_password": None,
        # "registry_token": None,
        # Optional: specify platform (e.g., "linux/amd64", "linux/arm64")
        # "platform": None,
    }
    
    # Create output directory if it doesn't exist
    output_dir = Path(config["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Read the get-oci-image.py script
    if not GET_OCI_IMAGE_SCRIPT.exists():
        print(f"Error: Script not found: {GET_OCI_IMAGE_SCRIPT}", file=sys.stderr)
        sys.exit(1)
    
    with open(GET_OCI_IMAGE_SCRIPT, 'r', encoding='utf-8') as f:
        script_content = f.read()
    
    # Replace all template variables at once
    all_replacements = {
        "oci_image": config["oci_image"],
        "storage": "local",  # Dummy value - will be overridden for local execution
        "registry_username": config.get("registry_username"),
        "registry_password": config.get("registry_password"),
        "registry_token": config.get("registry_token"),
        "platform": config.get("platform"),
    }
    
    modified_script = replace_template_variables(script_content, all_replacements)
    
    # Build replacement code - use string formatting to insert output_dir
    # Escape the path for use in Python raw string
    output_dir_str = str(output_dir).replace('\\', '\\\\').replace('"', '\\"')  # Escape for Python string
    
    # Modify the script to use local output directory instead of Proxmox storage
    # Use regex to find and replace the storage check block (more robust)
    # Pattern matches from "# Check if image already exists in storage" to the final "pass"
    storage_check_pattern = re.compile(
        r'    # Check if image already exists in storage\n    try:.*?except \(subprocess\.CalledProcessError, FileNotFoundError\):\n        # pveam not available or storage not accessible, continue with download\n        pass',
        re.DOTALL
    )
    storage_check_replacement = f'''    # Check if image already exists in local output directory
    image_base = image.split('/')[-1]
    safe_tag = tag.replace(':', '_').replace('/', '_')
    local_filename = f"{{{{image_base}}}}_{{{{safe_tag}}}}.tar"
    local_output_path = os.path.join(r"{output_dir_str}", local_filename)
    
    if os.path.exists(local_output_path):
        log(f"OCI image already exists locally: {{{{local_output_path}}}}")
        
        # Try to detect ostype from image name
        ostype = 'alpine'
        image_lower = oci_image.lower()
        if 'debian' in image_lower:
            ostype = 'debian'
        elif 'ubuntu' in image_lower:
            ostype = 'ubuntu'
        elif 'fedora' in image_lower:
            ostype = 'fedora'
        elif 'centos' in image_lower:
            ostype = 'centos'
        elif 'alpine' in image_lower:
            ostype = 'alpine'
        
        output = [
            {{"id": "template_path", "value": local_output_path}},
            {{"id": "ostype", "value": ostype}}
        ]
        print(json.dumps(output))
        return
    # Local file does not exist, continue with download'''
    
    modified_script = storage_check_pattern.sub(storage_check_replacement, modified_script)
    
    # Replace the import_to_proxmox call to save locally
    # Note: The pattern must match actual_tag (extracted version) not tag
    import_pattern = re.compile(
        r'        # Import to Proxmox storage \(or save locally if modified by downloadha\.py\)\s+log\(f"Importing to Proxmox storage: \{storage\}"\)\s+template_path = import_to_proxmox\(storage, tarball_path, image, actual_tag\)\s+\s+log\(f"OCI image successfully imported: \{template_path\}"\)',
        re.MULTILINE | re.DOTALL
    )
    
    # Escape output_dir_str for use in raw string
    output_dir_escaped = output_dir_str.replace('\\', '\\\\')
    import_replacement = f'''        # Save locally instead of importing to Proxmox
        # actual_tag already contains the version (extracted from image labels if tag was "latest")
        # image_base and safe_tag are already defined above (line 781, 783), so we reuse them
        # Build the local path using the existing variables (they're already set in the code above)
        local_output_path = os.path.join(r"{output_dir_escaped}", f"{{image_base}}_{{safe_tag}}.tar")
        log(f"Copying OCI tarball to {{local_output_path}}")
        try:
            shutil.copy(tarball_path, local_output_path)
            os.chmod(local_output_path, 0o644)  # Set permissions
        except Exception as e:
            error(f"Failed to copy tarball to local directory: {{str(e)}}")
        template_path = local_output_path  # Return local path instead of storage:path
        
        log(f"OCI image successfully saved to: {{template_path}}")'''
    
    modified_script = import_pattern.sub(import_replacement, modified_script)
    
    # Execute the modified script
    print(f"Downloading Home Assistant image: {config['oci_image']}", file=sys.stderr)
    print(f"Output directory: {output_dir}", file=sys.stderr)
    print("", file=sys.stderr)
    
    try:
        # Execute the script using Python
        import tempfile
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp_file:
            tmp_file.write(modified_script)
            tmp_file_path = tmp_file.name
        
        try:
            # Make sure it's executable
            os.chmod(tmp_file_path, 0o755)
            
            # Execute the script
            result = subprocess.run(
                [sys.executable, tmp_file_path],
                capture_output=False,  # Let output go to stdout/stderr directly
                text=True,
                check=False  # Don't raise exception on non-zero exit
            )
            
            sys.exit(result.returncode)
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_file_path)
            except OSError:
                pass
                
    except Exception as e:
        print(f"Error executing script: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

