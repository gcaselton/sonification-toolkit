# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# List of packages to bundle fully
packages_to_collect = [
    "strauss",
    "astroquery",
    "lightkurve",
    "matplotlib",
]

# Aggregate everything
all_datas, all_binaries, all_hiddenimports = [], [], []
for pkg in packages_to_collect:
    datas, binaries, hiddenimports = collect_all(pkg)
    all_datas += datas
    all_binaries += binaries
    all_hiddenimports += hiddenimports

# App assets
own_datas = [
    ('style_files', 'style_files'),
    ('suggested_data', 'suggested_data'),
    ('sound_assets', 'sound_assets'),
    ('settings', 'settings')
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=all_binaries,
    datas=own_datas + all_datas,
    hiddenimports=all_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
