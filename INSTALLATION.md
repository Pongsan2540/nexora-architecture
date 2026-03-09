# 🗺️ Map Application - Installation Guide

สำหรับโปรเจกต์ **nexora-ver-2**

## 📁 โครงสร้างโปรเจกต์ของคุณ

```
nexora-ver-2/
├── index.html
├── README.md
├── logo/
├── pages/
│   ├── landing.html
│   ├── blackhole-login.html
│   ├── register.html
│   ├── ai-search.html
│   ├── dashboard.html
│   ├── map.html ← ← ← อัปเดต file นี้
│   └── stream-conditions.html
├── assets/
│   ├── css/
│   │   ├── tokens.css
│   │   ├── components.css
│   │   ├── landing.css
│   │   ├── blackhole-login.css
│   │   ├── register.css
│   │   ├── ai-search.css
│   │   ├── dashboard.css
│   │   ├── stream-conditions.css
│   │   └── map.css ← ← ← ใส่ไฟล์นี้
│   └── js/
│       ├── landing.js
│       ├── register.js
│       ├── ai-search.js
│       ├── dashboard.js
│       ├── glassui.js ← ← ← ใส่ไฟล์นี้ (ถ้าไม่มี)
│       └── map.js ← ← ← ใส่ไฟล์นี้
└── data/
    └── places-config.json ← ← ← สร้างโฟลเดอร์นี้และใส่ไฟล์
```

## 🚀 วิธีติดตั้ง (3 ขั้นตอน)

### ขั้นตอนที่ 1: Copy ไฟล์ JavaScript
```bash
# คัดลอก map.js ไปยัง assets/js/
cp map.js assets/js/map.js

# ตรวจสอบ glassui.js มีอยู่แล้วหรือไม่
# ถ้าไม่มี ให้สร้างไฟล์ว่าง
touch assets/js/glassui.js
```

### ขั้นตอนที่ 2: Copy ไฟล์ CSS
```bash
# คัดลอก map.css ไปยัง assets/css/
cp map.css assets/css/map.css
```

### ขั้นตอนที่ 3: Update map.html และสร้าง Config Folder
```bash
# คัดลอก map.html ไปยัง pages/
cp map.html pages/map.html

# สร้างโฟลเดอร์ data ถ้ายังไม่มี
mkdir -p data

# คัดลอก places-config.json
cp places-config.json data/places-config.json
```

## ✅ Verification Checklist

ตรวจสอบว่าติดตั้งถูกต้อง:

```bash
# ตรวจสอบไฟล์ JS
ls -la assets/js/map.js        # ✅ ควรมี
ls -la assets/js/glassui.js    # ✅ ควรมี

# ตรวจสอบไฟล์ CSS
ls -la assets/css/map.css      # ✅ ควรมี

# ตรวจสอบไฟล์ HTML
ls -la pages/map.html          # ✅ ควรมี

# ตรวจสอบไฟล์ Config
ls -la data/places-config.json # ✅ ควรมี
```

## 🔧 วิธี Update map.js ให้ใช้ path ถูกต้อง

เปิดไฟล์ `assets/js/map.js` แล้อ ค้นหา:

```javascript
// บรรทัดที่ 47 ประมาณนี้
const response = await fetch('places-config.json');
```

เปลี่ยนเป็น:

```javascript
const response = await fetch('../data/places-config.json');
```

### หรืออยากให้โหลดจากรูท:
```javascript
const response = await fetch('./data/places-config.json');
```

## 📝 วิธีใช้ Add Place Feature

### 1. เปิด Map Page
```
http://localhost:8000/pages/map.html
```

### 2. คลิกปุ่ม "+ Add Place"
- ปุ่มอยู่ด้านซ้าย ใต้ search bar

### 3. กรอกฟอร์ม
- **Place Name** ← ต้องกรอก
- **Latitude** ← ต้องกรอก (ได้จากแผนที่)
- **Longitude** ← ต้องกรอก (ได้จากแผนที่)
- ข้อมูลอื่น ← ไม่บังคับ

### 4. ข้อมูลจะเก็บที่ localStorage
```javascript
localStorage.getItem('mapPlaces')  // ดูข้อมูลที่เก็บไว้
```

## 🌐 Server Setup (ถ้ากำลังพัฒนา)

ถ้าใช้ Live Server:
```bash
# ติดตั้ง live-server
npm install -g live-server

# รันจากรูทโปรเจกต์
live-server
```

ถ้าใช้ Python:
```bash
python -m http.server 8000
```

## 💾 Data Persistence

### ข้อมูลจะเก็บ 2 ที่:

#### 1️⃣ **localStorage** (Browser)
- ตัวประกอบของ browser แต่ละตัว
- ไม่ลบเมื่อปิด browser
- ลบเมื่อ clear cache
- ขนาด ~5-10 MB

#### 2️⃣ **places-config.json** (Config file)
- ข้อมูลเบื้องต้น
- Manual edit ได้
- ต้อง redeploy เพื่อ update

## 🔄 How to Export Data

### Export to JSON File
```javascript
// Copy & paste ในตัวปิดคอนโซล DevTools (F12)

const places = JSON.parse(localStorage.getItem('mapPlaces'));
const dataStr = JSON.stringify(places, null, 2);
const dataBlob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'places-export.json';
link.click();
```

### Import from JSON File
```javascript
// 1. ดาวน์โหลด JSON file
// 2. วาง code นี้ในคอนโซล:

const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.onchange = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = (ev) => {
    const data = JSON.parse(ev.target.result);
    localStorage.setItem('mapPlaces', JSON.stringify(data.places));
    location.reload();
  };
  reader.readAsText(file);
};
input.click();
```

## 🎨 Customization

### เปลี่ยนสีหลัก
แก้ไข `assets/css/map.css`:

```css
[data-theme="dark"]{
  --c0a:#8a7e6e;  /* เปลี่ยนสีนี้ */
}
```

### เปลี่ยน Center ของแผนที่
แก้ไข `assets/js/map.js` ประมาณบรรทัดที่ 90:

```javascript
const map = new maplibregl.Map({
  center: [100.5018, 13.7563],  // [longitude, latitude]
  zoom: 14,
});
```

## 🐛 Troubleshooting

### ❌ "Could not load config file"
**วิธีแก้:**
- ตรวจสอบเส้นทาง path ใน `map.js`
- เปิด DevTools (F12) → Console tab
- ดูข้อความ error

### ❌ Markers ไม่ปรากฏบนแผนที่
**วิธีแก้:**
- ตรวจสอบ lat/lng ถูกต้อง (-90 to 90, -180 to 180)
- ลบ localStorage: `localStorage.clear()` ใน console
- รีโหลดหน้า

### ❌ Modal "Add Place" ไม่เปิด
**วิธีแก้:**
- เปิด console ดู errors
- ตรวจสอบ `btnAddPlace` button มีอยู่
- ตรวจสอบ `map.js` load สำเร็จ

### ❌ Styling ผิด (ตัวอักษร, สี)
**วิธีแก้:**
- ตรวจสอบ `tokens.css` load ก่อน `map.css`
- ตรวจสอบ path ไฟล์ CSS

## 🚀 Next Steps (Enhancement)

สิ่งที่สามารถเพิ่มได้:

- [ ] Backend API สำหรับบันทึกลง database
- [ ] User authentication (login/signup)
- [ ] Share places with friends
- [ ] Real-time collaboration
- [ ] Mobile app version
- [ ] Advanced filtering
- [ ] Photo uploads

## 📚 Reference

- **MapLibre GL JS**: https://maplibre.org/maplibre-gl-js/
- **localStorage API**: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- **Geolocation**: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

## 💬 Support

ถ้ามีปัญหา:
1. เปิด DevTools (F12)
2. ดู Console tab ที่ error
3. Copy error message
4. Search Google with error message

---

**Last Updated:** March 2026  
**Map Version:** 1.0.0
