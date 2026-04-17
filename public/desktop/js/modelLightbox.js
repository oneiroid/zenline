import { ModelViewer } from './modelViewer.js';

export function showModelLightbox(glbFile) {
    const lightboxContainer = document.createElement('div');
    lightboxContainer.className = 'model-lightbox';
    document.body.appendChild(lightboxContainer);

    const closeButton = document.createElement('button');
    closeButton.className = 'model-lightbox-close';
    closeButton.innerHTML = '&times;';
    lightboxContainer.appendChild(closeButton);

    const viewerContainer = document.createElement('div');
    viewerContainer.className = 'model-viewer-container';
    lightboxContainer.appendChild(viewerContainer);

    const viewer = new ModelViewer(viewerContainer);
    viewer.loadModel(`/imgs/${glbFile}`);

    const handleResize = () => viewer.resize();
    window.addEventListener('resize', handleResize);

    const handleKeyup = (e) => {
        if (e.key === 'Escape') close();
    };
    window.addEventListener('keyup', handleKeyup);

    function close() {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keyup', handleKeyup);
        viewer.destroy();
        document.body.removeChild(lightboxContainer);
    }

    closeButton.onclick = close;
}
