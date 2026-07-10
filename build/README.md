# Build Directory — Beidar Desktop

هذا المجلد يحتوي على ملفات البناء والتجميع الخاصة بتطبيق **Beidar**.

## الهيكل (Structure)

```
build/
├── bin/                    # مخرج التجميع (ملفات exe + installer)
│   └── beidar-desktop.exe  # الملف التنفيذي بعد wails build
├── darwin/                 # ملفات خاصة بـ macOS (Info.plist)
├── windows/                # ملفات خاصة بـ Windows
│   ├── icon.ico            # أيقونة التطبيق
│   ├── installer/          # ملفات NSIS للمثبت
│   ├── info.json           # معلومات التطبيق (حقوق، إصدار)
│   └── wails.exe.manifest  # Manifest file
└── appicon.png             # أيقونة المصدر (يُستخدم لإنشاء icon.ico)
```

## أوامر البناء

```bash
# بناء عادي
wails build -clean -platform windows/amd64

# بناء مع مثبت NSIS
wails build -clean -platform windows/amd64 -nsis
```

## مخرج البناء

| الملف | المسار |
|-------|--------|
| ملف تنفيذي | `build/bin/beidar-desktop.exe` |
| مثبت Windows | `build/bin/beidar-desktop-amd64-installer.exe` |
