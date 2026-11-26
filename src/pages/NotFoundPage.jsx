// src/pages/NotFoundPage.jsx — Trang lỗi 404
export function NotFoundPage({ onHome }) {
  return (
    <section className="page container notfound-page">
      <strong className="notfound-code">404</strong>
      <h1>Trang bạn tìm không tồn tại</h1>
      <p>Đường dẫn có thể đã bị đổi hoặc bạn nhập sai. Hãy quay lại trang chủ để tiếp tục hành trình.</p>
      <button type="button" onClick={onHome}>Về trang chủ</button>
    </section>
  )
}

export default NotFoundPage
