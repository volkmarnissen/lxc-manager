Alpine Package Generator

This folder contains:
- `apk-template/`: generic templates for APK packages
- `generate-ap.sh`: scaffolds a new package dir from an INI file
- `common/node-build.sh`: rebuilds native Node modules for target arch

Usage:
```sh
cd alpine/package
./generate-ap.sh <pkgname> <pkgname>.ini
```

INI keys:
- `pkgname`, `pkgver`, `pkgrel`, `pkgdesc`, `url`, `license`
- `depends`, `makedepends`
- `npmpackage` (npm package to install)
- `app_dirs` (space-separated list, e.g. `/config /data /ssl`)
- `app_dirs_owner` (e.g. `modbus2mqtt:dialout`)

Notes:
- OpenSSH configuration is optional and only applied if `sshd` exists.
- The generated `APKBUILD` uses template files and a `prepare()` step to render service/install scripts.