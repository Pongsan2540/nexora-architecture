// โหลด sidebar.html แล้ว inject เข้า #sidebar-root
// พร้อม highlight active item อัตโนมัติตาม URL ปัจจุบัน

(function () {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  fetch('/assets/components/sidebar.html')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      root.innerHTML = html;

      const currentPage = location.pathname.split('/').pop() || 'stream.html';

      root.querySelectorAll('.sb-item[data-page]').forEach(el => {
        if (el.dataset.page === currentPage) {
          el.classList.add('active');
        }
      });
    })
    .catch(err => console.error('Sidebar load failed:', err));
})();
