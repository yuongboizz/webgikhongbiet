# Chốt Kèo Đi Chơi — Lịch Rảnh Hội Bạn Thân (100% Netlify)

Bộ mã nguồn hoàn chỉnh chạy trực tiếp trên **Netlify** với kho lưu trữ miễn phí **Netlify Blobs** tích hợp sẵn (không cần Firebase hay máy chủ bên ngoài).

## Cấu trúc thư mục
- `index.html`: Giao diện đăng ký lịch rảnh, xếp hạng Top 5 Ngày Vàng và bình chọn kèo đi chơi.
- `netlify/functions/sync.mjs`: API đồng bộ dữ liệu trực tuyến của từng nhóm lên **Netlify Blobs**.
- `package.json`: Khai báo thư viện `@netlify/blobs`.
- `netlify.toml`: Cấu hình thư mục xuất bản và hàm serverless cho Netlify.

## Hướng dẫn đưa lên Netlify trong 3 phút
1. Tạo một repository mới trên **GitHub** (ví dụ: `chot-keo-di-choi`) và tải toàn bộ các file/thư mục trong gói này lên đó.
2. Đăng nhập **Netlify** → chọn **Add new site** → **Import an existing project** → chọn **GitHub** và trỏ tới repository vừa tạo.
3. Bấm **Deploy site**. Sau khoảng 30 giây, Netlify sẽ cấp đường link web chính thức và tự động kích hoạt đồng bộ dữ liệu trực tuyến cho cả nhóm!
