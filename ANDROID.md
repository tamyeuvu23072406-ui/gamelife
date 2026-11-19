# Hướng dẫn đóng gói APK từ Termux (Android)

Dự án đã được cấu hình sẵn chế độ build tĩnh (`npm run build:android`) và workflow GitHub Actions (`.github/workflows/build-apk.yml`).

## Bước 1: Giải nén đè & chuẩn bị trong Termux
```bash
termux-setup-storage
pkg update && pkg install nodejs-lts git -y

# Copy thư mục từ Download vào bộ nhớ trong của Termux để chạy npm nhanh và không lỗi symlink
rm -rf ~/gamelife
cp -r /storage/emulated/0/Download/gamelife ~/gamelife
cd ~/gamelife

# Cài thư viện & build thử bản web tĩnh
npm install
npm run build:android
```

## Bước 2: Đẩy lên GitHub để tự động xuất file APK
```bash
git init
git add .
git commit -m "Update gamelife with aging, marriage, birth and Android build"
git branch -M main
git remote add origin https://github.com/<TEN_USER_CUA_BAN>/gamelife.git
git push -u origin main
```
Sau khi push xong:
1. Mở repo trên trình duyệt → vào tab **Actions** → chọn **Build Android APK**.
2. Đợi ~2 phút chạy xong, kéo xuống cuối trang mục **Artifacts** và tải **`soulmate-debug-apk`**.
3. Giải nén file zip và cài đặt `app-debug.apk` lên điện thoại.
