#!/usr/bin/env python3
"""
Download OCI image from Docker Registry and import to Proxmox storage.

This script downloads an OCI image using the Docker Registry HTTP API,
creates an OCI tarball compatible with Proxmox, and imports it to the
specified storage.

Parameters (via template variables):
  oci_image (required): OCI image reference (e.g., docker://alpine:latest, oci://ghcr.io/owner/repo:tag)
  storage (required): Proxmox storage name (default: local)
  registry_username (optional): Username for registry authentication
  registry_password (optional): Password for registry authentication
  registry_token (optional): Bearer token for registry authentication (alternative to username/password)
  platform (optional): Target platform (e.g., linux/amd64, linux/arm64). Auto-detects if not specified.

Output (JSON to stdout):
  [{"id": "template_path", "value": "storage:vztmpl/image_tag.tar"}, {"id": "ostype", "value": "alpine"}]

All logs and progress go to stderr.
"""

import json
import sys
import os
import re
import subprocess
import urllib.request
import urllib.parse
import urllib.error
import base64
import hashlib
import tempfile
import tarfile
import shutil
from typing import Optional, Dict, Any, Tuple, List

# Default timeout for HTTP requests (in seconds)
# Use a reasonable timeout: 5 minutes for auth/manifest, 30 minutes for large blob downloads
HTTP_TIMEOUT_AUTH = 300  # 5 minutes for authentication and manifest requests
HTTP_TIMEOUT_BLOB = 1800  # 30 minutes for blob downloads (large files)


def log(message: str) -> None:
    """Print message to stderr (for logging/progress)."""
    print(message, file=sys.stderr)


def error(message: str, exit_code: int = 1) -> None:
    """Print error to stderr and exit."""
    log(f"Error: {message}")
    sys.exit(exit_code)


def parse_image_ref(oci_image: str) -> Tuple[str, str, str]:
    """
    Parse OCI image reference.
    
    Returns: (registry, image, tag)
    Examples:
      docker://alpine:latest -> (docker.io, library/alpine, latest)
      docker://user/image:tag -> (docker.io, user/image, tag)
      oci://ghcr.io/owner/repo:tag -> (ghcr.io, owner/repo, tag)
      alpine:latest -> (docker.io, library/alpine, latest)
    """
    # Remove protocol prefix if present
    image_ref = re.sub(r'^[^:]+://', '', oci_image)
    
    # Parse registry, image, and tag
    if '/' in image_ref:
        parts = image_ref.split('/', 1)
        if '.' in parts[0] or ':' in parts[0]:
            # Has explicit registry (e.g., ghcr.io, registry.example.com:5000)
            registry = parts[0]
            image_with_tag = parts[1]
        else:
            # Default to docker.io
            registry = "docker.io"
            image_with_tag = image_ref
    else:
        # No registry specified, default to docker.io
        registry = "docker.io"
        image_with_tag = image_ref
    
    # Split image and tag
    if ':' in image_with_tag:
        image, tag = image_with_tag.rsplit(':', 1)
    else:
        image = image_with_tag
        tag = "latest"
    
    # Docker Hub special case: library namespace for official images
    if registry == "docker.io" and '/' not in image:
        image = f"library/{image}"
    
    # Normalize registry URL
    if registry == "docker.io":
        registry_url = "registry-1.docker.io"
    elif registry == "ghcr.io":
        registry_url = "ghcr.io"
    else:
        registry_url = registry
    
    return registry_url, image, tag


def authenticate(registry_url: str, image: str, username: Optional[str] = None,
                 password: Optional[str] = None, token: Optional[str] = None) -> Optional[str]:
    """
    Authenticate with Docker Registry and return bearer token.
    
    Returns bearer token for subsequent API calls, or None if no auth required.
    For public images (Docker Hub), gets an anonymous token if authentication is requested.
    """
    # If token provided, use it directly
    if token:
        return token
    
    # Try to access the registry to check if authentication is needed
    # This works for both authenticated and public images
    manifest_url = f"https://{registry_url}/v2/{image}/manifests/latest"
    req = urllib.request.Request(manifest_url)
    
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_AUTH) as response:
            # If we get 200, no auth needed
            if response.status == 200:
                return None
    except urllib.error.HTTPError as e:
        if e.code == 401:
            # Authentication required - get token (either authenticated or anonymous)
            auth_header_line = e.headers.get('WWW-Authenticate', '')
            if not auth_header_line:
                # Try accessing v2/ endpoint to get auth header
                v2_url = f"https://{registry_url}/v2/"
                v2_req = urllib.request.Request(v2_url)
                try:
                    with urllib.request.urlopen(v2_req, timeout=HTTP_TIMEOUT_AUTH) as v2_resp:
                        if v2_resp.status == 200:
                            return None
                except urllib.error.HTTPError as v2_err:
                    if v2_err.code == 401:
                        auth_header_line = v2_err.headers.get('WWW-Authenticate', '')
            
            if auth_header_line:
                # Parse WWW-Authenticate: Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/alpine:pull"
                realm_match = re.search(r'realm="([^"]+)"', auth_header_line)
                service_match = re.search(r'service="([^"]+)"', auth_header_line)
                
                if realm_match:
                    token_service = realm_match.group(1)
                    service = service_match.group(1) if service_match else registry_url
                    scope = f"repository:{image}:pull"
                    
                    # Build token URL
                    token_url = f"{token_service}?service={service}&scope={scope}"
                    token_req = urllib.request.Request(token_url)
                    
                    # If username/password provided, use Basic Auth
                    if username and password:
                        auth_string = f"{username}:{password}".encode('utf-8')
                        auth_header = base64.b64encode(auth_string).decode('utf-8')
                        token_req.add_header("Authorization", f"Basic {auth_header}")
                    # Otherwise, try anonymous token (works for Docker Hub public images)
                    
                    try:
                        with urllib.request.urlopen(token_req, timeout=HTTP_TIMEOUT_AUTH) as token_resp:
                            token_data = json.loads(token_resp.read().decode('utf-8'))
                            retrieved_token = token_data.get('token')
                            if retrieved_token:
                                log("Authentication successful (anonymous token for public image)" if not username else "Authentication successful (with credentials)")
                            return retrieved_token
                    except urllib.error.HTTPError as token_err:
                        if token_err.code == 401 and username and password:
                            error(f"Authentication failed: invalid credentials for {registry_url}")
                        elif token_err.code == 401:
                            # Anonymous access not allowed - but try anyway, might work for some registries
                            log(f"Warning: Anonymous token request failed (HTTP {token_err.code}), trying without token")
                            return None
                        else:
                            error(f"Failed to get token: HTTP {token_err.code}")
                    except Exception as token_e:
                        log(f"Warning: Token request error: {str(token_e)}, trying without token")
                        return None
            else:
                # No WWW-Authenticate header - might not need auth
                log("No WWW-Authenticate header found, assuming public access")
                return None
        elif e.code == 404:
            # Image not found - but still try to get token if auth is required
            # For now, return None and let get_manifest handle the 404
            log(f"Image manifest not found (404), will try to fetch with tag")
            return None
        else:
            # Other HTTP error - try without auth
            log(f"Warning: HTTP {e.code} when checking authentication, trying without token")
            return None
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError) or 'timed out' in str(e).lower():
            error(f"Timeout during authentication check: {str(e)}. Try again or check network connection.")
        else:
            log(f"Warning: Network error during authentication check: {str(e)}")
            return None
    except TimeoutError as e:
        error(f"Timeout during authentication check: {str(e)}. Try again or check network connection.")
    except Exception as e:
        # For public images, continue without auth
        log(f"Warning: Could not check authentication: {str(e)}, trying as public image")
        return None
    
    # Default: no auth needed
    return None


def get_manifest(registry_url: str, image: str, tag: str, token: Optional[str] = None,
                 platform: Optional[str] = None) -> Dict[str, Any]:
    """
    Get image manifest from registry.
    
    Handles multi-arch images by selecting appropriate platform manifest.
    Returns the platform-specific manifest (v2 schema 2).
    """
    manifest_url = f"https://{registry_url}/v2/{image}/manifests/{tag}"
    
    req = urllib.request.Request(manifest_url)
    req.add_header("Accept", "application/vnd.docker.distribution.manifest.v2+json, "
                              "application/vnd.docker.distribution.manifest.list.v2+json, "
                              "application/vnd.oci.image.manifest.v1+json, "
                              "application/vnd.oci.image.index.v1+json")
    
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_AUTH) as response:
            manifest_data = json.loads(response.read().decode('utf-8'))
            media_type = response.headers.get('Content-Type', manifest_data.get('mediaType', ''))
            
            # Check if it's a manifest list (multi-arch)
            if (media_type.endswith('manifest.list.v2+json') or
                media_type.endswith('image.index.v1+json') or
                'manifests' in manifest_data):
                # Multi-arch manifest - select platform
                manifests = manifest_data.get('manifests', [])
                if not manifests:
                    error("No platform manifests found in manifest list")
                
                # Select platform manifest
                selected_manifest = None
                if platform:
                    # Parse platform (e.g., "linux/amd64" -> os="linux", arch="amd64")
                    platform_parts = platform.split('/', 1)
                    target_os = platform_parts[0] if len(platform_parts) > 0 else "linux"
                    target_arch = platform_parts[1] if len(platform_parts) > 1 else "amd64"
                else:
                    # Auto-detect: prefer linux/amd64, fallback to first available
                    target_os = "linux"
                    target_arch = "amd64"
                
                log(f"Selecting platform: {target_os}/{target_arch}")
                
                # Find matching platform
                for mf in manifests:
                    platform_info = mf.get('platform', {})
                    mf_os = platform_info.get('os', 'linux')
                    mf_arch = platform_info.get('architecture', 'amd64')
                    if mf_os == target_os and mf_arch == target_arch:
                        selected_manifest = mf
                        log(f"Found matching platform manifest: {mf_os}/{mf_arch}")
                        break
                
                # If no exact match, try OS match only
                if not selected_manifest:
                    for mf in manifests:
                        platform_info = mf.get('platform', {})
                        if platform_info.get('os', 'linux') == target_os:
                            selected_manifest = mf
                            log(f"Found OS-matching manifest: {platform_info.get('os')}/{platform_info.get('architecture')}")
                            break
                
                # If still no match, use first manifest
                if not selected_manifest:
                    selected_manifest = manifests[0]
                    platform_info = selected_manifest.get('platform', {})
                    log(f"Using first available manifest: {platform_info.get('os', 'linux')}/{platform_info.get('architecture', 'unknown')}")
                
                # Fetch the platform-specific manifest
                digest = selected_manifest['digest']
                platform_url = f"https://{registry_url}/v2/{image}/manifests/{digest}"
                platform_req = urllib.request.Request(platform_url)
                platform_req.add_header("Accept", "application/vnd.docker.distribution.manifest.v2+json, "
                                                   "application/vnd.oci.image.manifest.v1+json")
                if token:
                    platform_req.add_header("Authorization", f"Bearer {token}")
                
                with urllib.request.urlopen(platform_req, timeout=HTTP_TIMEOUT_AUTH) as platform_resp:
                    platform_manifest = json.loads(platform_resp.read().decode('utf-8'))
                    log(f"Fetched platform-specific manifest: {len(platform_manifest.get('layers', []))} layers")
                    return platform_manifest
            else:
                # Single manifest (not multi-arch)
                log(f"Single manifest (not multi-arch): {len(manifest_data.get('layers', []))} layers")
                return manifest_data
                
    except urllib.error.HTTPError as e:
        if e.code == 404:
            error(f"Image {image}:{tag} not found in registry {registry_url}")
        elif e.code == 401:
            # 401 Unauthorized - might need token or token expired
            # For Docker Hub, we should have gotten an anonymous token in authenticate()
            # If we still get 401, try to get an anonymous token and retry
            if not token:
                log("Got 401 without token, attempting to get anonymous token...")
                try:
                    auth_header_line = e.headers.get('WWW-Authenticate', '')
                    if auth_header_line:
                        realm_match = re.search(r'realm="([^"]+)"', auth_header_line)
                        service_match = re.search(r'service="([^"]+)"', auth_header_line)
                        if realm_match:
                            token_service = realm_match.group(1)
                            service = service_match.group(1) if service_match else registry_url
                            scope = f"repository:{image}:pull"
                            token_url = f"{token_service}?service={service}&scope={scope}"
                            token_req = urllib.request.Request(token_url)
                            with urllib.request.urlopen(token_req, timeout=HTTP_TIMEOUT_AUTH) as token_resp:
                                token_data = json.loads(token_resp.read().decode('utf-8'))
                                token = token_data.get('token')
                                if token:
                                    log("Retrieved anonymous token, retrying manifest fetch...")
                                    # Retry with token - recursively call get_manifest with token
                                    return get_manifest(registry_url, image, tag, token, platform)
                except Exception as retry_e:
                    log(f"Failed to get anonymous token: {str(retry_e)}")
            
            # If we still have 401 after retry, it's likely a private image
            error(f"Authentication required for {registry_url}. Image might be private - please provide registry_username and registry_password.")
        else:
            error(f"Failed to fetch manifest: HTTP {e.code}")
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError) or 'timed out' in str(e).lower():
            error(f"Timeout fetching manifest: {str(e)}. Try again or check network connection.")
        else:
            error(f"Network error fetching manifest: {str(e)}")
    except TimeoutError as e:
        error(f"Timeout fetching manifest: {str(e)}. Try again or check network connection.")
    except Exception as e:
        error(f"Failed to fetch manifest: {str(e)}")


def download_blob(registry_url: str, image: str, digest: str, token: Optional[str],
                  output_path: str, progress_callback=None) -> None:
    """
    Download a blob (config or layer) from registry.
    
    Args:
        registry_url: Registry URL
        image: Image name
        digest: Blob digest (e.g., sha256:abc123...)
        token: Bearer token (optional)
        output_path: Path to save the blob
        progress_callback: Optional callback(downloaded_bytes, total_bytes) for progress
    """
    blob_url = f"https://{registry_url}/v2/{image}/blobs/{digest}"
    
    req = urllib.request.Request(blob_url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_BLOB) as response:
            total_size = int(response.headers.get('Content-Length', 0))
            downloaded = 0
            # Use larger chunk size for better performance (64KB)
            chunk_size = 65536
            last_progress_update = 0
            
            with open(output_path, 'wb') as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # Update progress via callback - callback decides when to log
                    if progress_callback and total_size > 0:
                        # Always call callback, but callback itself filters when to log
                        progress_callback(downloaded, total_size)
    except urllib.error.HTTPError as e:
        error(f"Failed to download blob {digest}: HTTP {e.code} - {e.reason}")
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError) or 'timed out' in str(e).lower():
            error(f"Timeout downloading blob {digest}: {str(e)}. Try again or check network connection.")
        else:
            error(f"Network error downloading blob {digest}: {str(e)}")
    except TimeoutError as e:
        error(f"Timeout downloading blob {digest}: {str(e)}. Try again or check network connection.")
    except IOError as e:
        error(f"I/O error writing blob {digest}: {str(e)}")
    except Exception as e:
        error(f"Failed to download blob {digest}: {str(e)}")


def create_oci_tarball(config_blob_path: str, layer_blob_paths: List[str], 
                       image_name: str, tag: str, output_path: str) -> None:
    """
    Create OCI tarball compatible with Proxmox.
    
    Proxmox expects OCI tarballs with this structure:
    - manifest.json (OCI image manifest)
    - <digest>/ (directory for each layer)
      - layer.tar (the actual layer tarball)
    
    For simplicity, we create a tarball with:
    - manifest.json
    - config.json (image config)
    - All layers as layer-*.tar
    """
    # Calculate digests and sizes for config
    config_size = os.path.getsize(config_blob_path)
    config_sha256 = hashlib.sha256()
    with open(config_blob_path, 'rb') as f:
        # Read in chunks to avoid loading entire file into memory
        chunk_size = 65536
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            config_sha256.update(chunk)
    config_digest = f"sha256:{config_sha256.hexdigest()}"
    
    # Calculate digests and sizes for layers
    layer_metadata = []
    for layer_path in layer_blob_paths:
        layer_size = os.path.getsize(layer_path)
        layer_sha256 = hashlib.sha256()
        with open(layer_path, 'rb') as f:
            # Read in chunks to avoid loading entire file into memory
            chunk_size = 65536
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                layer_sha256.update(chunk)
        layer_digest = f"sha256:{layer_sha256.hexdigest()}"
        layer_metadata.append({
            "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
            "size": layer_size,
            "digest": layer_digest
        })
    
    # Create manifest
    manifest = {
        "schemaVersion": 2,
        "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
        "config": {
            "mediaType": "application/vnd.docker.container.image.v1+json",
            "size": config_size,
            "digest": config_digest
        },
        "layers": layer_metadata
    }
    
    # Write tarball
    with tarfile.open(output_path, 'w') as tar_file:
        # Add config as config.json
        tar_file.add(config_blob_path, arcname='config.json')
        
        # Add layers
        for i, layer_path in enumerate(layer_blob_paths):
            tar_file.add(layer_path, arcname=f'layer-{i}.tar')
        
        # Write manifest.json to temp file and add to tar
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as tmp_manifest:
            json.dump(manifest, tmp_manifest, indent=2)
            tmp_manifest_path = tmp_manifest.name
        
        try:
            tar_file.add(tmp_manifest_path, arcname='manifest.json')
        finally:
            os.unlink(tmp_manifest_path)


def detect_ostype_from_config(config_blob_path: str) -> str:
    """
    Detect OS type from OCI image config.
    
    Returns ostype string compatible with Proxmox (alpine, debian, ubuntu, fedora, centos).
    """
    try:
        with open(config_blob_path, 'r') as f:
            config = json.load(f)
        
        # Check os field
        os_type = config.get('os', 'linux').lower()
        if os_type != 'linux':
            return 'alpine'  # Default for non-Linux
        
        # Check architecture
        arch = config.get('architecture', 'amd64').lower()
        
        # Try to detect from image config environment or other fields
        env = config.get('config', {}).get('Env', [])
        image_name = ' '.join(env).lower()
        
        # Check for common distribution indicators
        if any(x in image_name for x in ['alpine', 'apk']):
            return 'alpine'
        elif any(x in image_name for x in ['debian']):
            return 'debian'
        elif any(x in image_name for x in ['ubuntu']):
            return 'ubuntu'
        elif any(x in image_name for x in ['fedora']):
            return 'fedora'
        elif any(x in image_name for x in ['centos', 'rocky', 'rhel']):
            return 'centos'
        
        # Default to alpine for Linux images
        return 'alpine'
    except Exception:
        # If detection fails, return default
        return 'alpine'


def extract_version_from_config(config_blob_path: str, fallback_tag: str) -> str:
    """
    Extract version tag from OCI image config labels.
    
    Tries to find version in common label fields:
    - org.opencontainers.image.version
    - io.hass.version
    - org.opencontainers.image.revision (if version not found)
    
    Returns the extracted version tag, or fallback_tag if not found.
    """
    try:
        with open(config_blob_path, 'r') as f:
            config = json.load(f)
        
        # Check labels in config.config.Labels
        labels = config.get('config', {}).get('Labels', {})
        
        # Try common version label fields (in order of preference)
        version_fields = [
            'org.opencontainers.image.version',
            'io.hass.version',
            'org.opencontainers.image.revision',
            'version',
        ]
        
        for field in version_fields:
            if field in labels:
                version = labels[field]
                if version and version.strip():
                    # Clean up version tag (remove leading 'v' if present, keep the rest)
                    version = version.strip()
                    if version.lower().startswith('v') and len(version) > 1:
                        version = version[1:]
                    return version
        
        # If no version found in labels, return fallback
        return fallback_tag
    except Exception:
        # If extraction fails, return fallback
        return fallback_tag


def import_to_proxmox(storage: str, tarball_path: str, image_name: str, tag: str) -> str:
    """
    Import OCI tarball to Proxmox storage.
    
    Proxmox stores OCI images in the vztmpl directory of the storage.
    For local storage, this is typically /var/lib/vz/template/oci/
    For other storages, the path is determined by the storage configuration.
    
    Returns the template path in format: storage:vztmpl/image_tag.tar
    """
    # Extract image name for filename (last component)
    image_base = image_name.split('/')[-1]
    # Create filename: image_tag.tar (replace : with _ if tag contains it)
    safe_tag = tag.replace(':', '_').replace('/', '_')
    filename = f"{image_base}_{safe_tag}.tar"
    
    # Try to determine storage path
    # For local storage, use /var/lib/vz/template/oci/
    # For other storages, we'd need to query pvesm status, but for now use local
    if storage == "local":
        storage_dir = "/var/lib/vz/template/oci"
    else:
        # Try to get storage path from pvesm status
        try:
            result = subprocess.run(['pvesm', 'status', '-storage', storage], 
                                  capture_output=True, text=True, check=True)
            # Parse output to get storage path (complex, simplified for now)
            storage_dir = f"/mnt/pve/{storage}/template/oci"  # Common path for non-local storage
        except (subprocess.CalledProcessError, FileNotFoundError):
            # Fallback to local path structure
            storage_dir = f"/var/lib/vz/template/oci"
            log(f"Warning: Could not determine storage path for {storage}, using {storage_dir}")
    
    # Ensure storage directory exists
    os.makedirs(storage_dir, mode=0o755, exist_ok=True)
    
    # Copy tarball to storage directory
    dest_path = os.path.join(storage_dir, filename)
    log(f"Copying OCI tarball to {dest_path}")
    try:
        shutil.copy(tarball_path, dest_path)
        os.chmod(dest_path, 0o644)  # Set permissions
    except PermissionError:
        error(f"Permission denied: Cannot write to {dest_path}. Script needs root or storage access.")
    except Exception as e:
        error(f"Failed to copy tarball to storage: {str(e)}")
    
    # Return template path in Proxmox format
    template_path = f"{storage}:vztmpl/{filename}"
    return template_path


def main() -> None:
    """Main function."""
    # Get parameters from template variables (substituted by VariableResolver before execution)
    # If variable is not set, it remains as {{ variable_name }}, which we can detect
    oci_image = "{{ oci_image }}"
    storage = "{{ storage }}"
    registry_username = "{{ registry_username }}"  # Optional
    registry_password = "{{ registry_password }}"  # Optional
    registry_token = "{{ registry_token }}"  # Optional
    platform = "{{ platform }}"  # Optional
    
    # Check if template variables are still present (not substituted = error)
    if oci_image.startswith('{{') or not oci_image or oci_image == "{{ oci_image }}":
        error("oci_image parameter is required!")
    
    if storage.startswith('{{') or storage == "{{ storage }}":
        storage = 'local'  # Default
    
    # Normalize optional parameters - if still template format, treat as None
    if registry_username.startswith('{{') or registry_username == "{{ registry_username }}":
        registry_username = None
    elif not registry_username or registry_username.strip() == "":
        registry_username = None
    
    if registry_password.startswith('{{') or registry_password == "{{ registry_password }}":
        registry_password = None
    elif not registry_password or registry_password.strip() == "":
        registry_password = None
    
    if registry_token.startswith('{{') or registry_token == "{{ registry_token }}":
        registry_token = None
    elif not registry_token or registry_token.strip() == "":
        registry_token = None
    
    if platform.startswith('{{') or platform == "{{ platform }}":
        platform = None
    elif not platform or platform.strip() == "":
        platform = None
    
    log(f"Downloading OCI image: {oci_image}")
    if platform:
        log(f"Target platform: {platform}")
    
    # Parse image reference
    registry_url, image, tag = parse_image_ref(oci_image)
    log(f"Registry: {registry_url}, Image: {image}, Tag: {tag}")
    
    # Authenticate
    log("Authenticating with registry...")
    token = authenticate(registry_url, image, registry_username, registry_password, registry_token)
    if token:
        log("Authentication successful")
    else:
        log("No authentication required (public image)")
    
    # Get manifest (needed to get config digest for version extraction)
    log("Fetching image manifest...")
    manifest = get_manifest(registry_url, image, tag, token, platform)
    
    # Extract config and layer digests
    config_digest = manifest['config']['digest']
    layers = manifest['layers']
    
    # Download config first (small, needed to extract version for "latest" tag check)
    log(f"Downloading config blob: {config_digest}")
    with tempfile.TemporaryDirectory() as tmpdir_config:
        config_path_check = os.path.join(tmpdir_config, 'config.json')
        def config_progress(d, t):
            if t > 0:
                log(f"  Config: {d:,}/{t:,} bytes ({100*d//t}%)")
        download_blob(registry_url, image, config_digest, token, config_path_check, config_progress)
        
        # Detect ostype from config
        ostype = detect_ostype_from_config(config_path_check)
        log(f"Detected ostype: {ostype}")
        
        # Extract version tag from config if tag is "latest"
        # For production use, we want the actual version (e.g., "2024.12.0") instead of "latest"
        actual_tag = tag
        if tag == "latest" or tag.lower() == "latest":
            extracted_version = extract_version_from_config(config_path_check, tag)
            if extracted_version != tag:
                actual_tag = extracted_version
                log(f"Extracted version from image labels: {actual_tag}")
        
        # Check if image with actual_tag (extracted version) already exists in storage
        # This check happens AFTER version extraction, so we can check for the correct version
        try:
            result = subprocess.run(['pveam', 'list', storage], capture_output=True, text=True, check=True)
            image_base = image.split('/')[-1]
            safe_tag = actual_tag.replace(':', '_').replace('/', '_').replace('\\', '_')
            search_pattern = f"{image_base}_{safe_tag}"
            
            # Check for exact match in pveam output (format: storage:vztmpl/image_tag.tar)
            lines = result.stdout.split('\n')
            for line in lines:
                # Look for pattern: storage:vztmpl/image_tag.tar
                if search_pattern in line and '.tar' in line:
                    template_path = line.split()[0]  # First field is storage:path
                    if search_pattern in template_path:
                        log(f"OCI image already exists: {template_path} (version: {actual_tag})")
                        
                        output = [
                            {"id": "template_path", "value": template_path},
                            {"id": "ostype", "value": ostype}
                        ]
                        print(json.dumps(output))
                        sys.exit(0)
        except (subprocess.CalledProcessError, FileNotFoundError):
            # pveam not available or storage not accessible, continue with download
            log("pveam not available or storage not accessible, continuing with download...")
        
        # If we get here, image doesn't exist yet - proceed with full download
        log(f"Image with version {actual_tag} not found in storage, starting download...")
    
    # actual_tag and ostype are now available for the full download
    log(f"Found {len(layers)} layers to download")
    
    # Create temporary directory for full download
    with tempfile.TemporaryDirectory() as tmpdir:
        # Re-download config (will be reused in tarball creation)
        config_path = os.path.join(tmpdir, 'config.json')
        layer_paths = []
        
        log(f"Downloading config blob: {config_digest}")
        def config_progress_full(d, t):
            if t > 0:
                log(f"  Config: {d:,}/{t:,} bytes ({100*d//t}%)")
        download_blob(registry_url, image, config_digest, token, config_path, config_progress_full)
        
        # Download layers
        for i, layer in enumerate(layers):
            layer_digest = layer['digest']
            layer_size = layer.get('size', 0)
            layer_path = os.path.join(tmpdir, f'layer-{i}.tar.gz')
            layer_paths.append(layer_path)
            
            log(f"Downloading layer {i+1}/{len(layers)}: {layer_digest[:16]}... ({layer_size:,} bytes)")
            # Create progress callback that only logs every 500MB or when layer completes
            class LayerProgressCallback:
                def __init__(self, layer_num, total_layers):
                    self.layer_num = layer_num
                    self.total_layers = total_layers
                    self.last_logged_bytes = 0
                
                def __call__(self, d, t):
                    if t > 0:
                        bytes_since_last_log = d - self.last_logged_bytes
                        is_complete = d >= t
                        is_500mb_update = bytes_since_last_log >= 524288000  # 500MB
                        
                        # Log every 500MB and at completion (no 0% message)
                        if is_500mb_update or is_complete:
                            progress_percent = (d * 100) // t if t > 0 else 0
                            log(f"  Layer {self.layer_num}/{self.total_layers}: {d:,}/{t:,} bytes ({progress_percent}%)")
                            self.last_logged_bytes = d
            
            download_blob(registry_url, image, layer_digest, token, layer_path,
                         LayerProgressCallback(i+1, len(layers)))
        
        # Create OCI tarball
        image_base = image.split('/')[-1]
        # Use actual_tag (with version) for filename instead of original tag (which might be "latest")
        safe_tag = actual_tag.replace(':', '_').replace('/', '_')
        tarball_path = os.path.join(tmpdir, f'{image_base}_{safe_tag}.tar')
        log(f"Creating OCI tarball: {tarball_path}")
        create_oci_tarball(config_path, layer_paths, image, actual_tag, tarball_path)
        
        # Import to Proxmox storage (or save locally if modified by downloadha.py)
        log(f"Importing to Proxmox storage: {storage}")
        template_path = import_to_proxmox(storage, tarball_path, image, actual_tag)
        
        log(f"OCI image successfully imported: {template_path}")
    
    # Output JSON
    output = [
        {"id": "template_path", "value": template_path},
        {"id": "ostype", "value": ostype}
    ]
    print(json.dumps(output))
    # Explicitly exit with success code
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        error(f"Unexpected error: {str(e)}", 1)

