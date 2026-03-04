# Glass UI

## Folder structure

```
glassui/
├── index.html
├── pages/
│   ├── blackhole-login.html
│   ├── register.html
│   ├── landing.html
│   ├── dashboard.html
│   ├── map.html
│   └── ai-search.html
└── assets/
    ├── css/
    │   ├── tokens.css        ← design tokens (load 1st)
    │   ├── components.css    ← shared UI   (load 2nd)
    │   └── [page].css        ← page styles (load 3rd)
    └── js/
        ├── glassui.js        ← shared utils (load 1st)
        └── [page].js         ← page logic  (load 2nd)
```

## Run
Open `index.html` in a browser. No build step needed.

## GlassUI utilities
```js
GlassUI.nav.init()
GlassUI.nav.go('url')
GlassUI.theme.init('themeBtn')
GlassUI.grid.init('bgCanvas')
GlassUI.grid.ripple(x, y)
```
