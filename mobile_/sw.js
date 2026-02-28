// Un Service Worker vacío es suficiente para engañar al navegador y que permita la instalación
self.addEventListener('fetch', function() {});