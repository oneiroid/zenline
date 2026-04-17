import { ModelViewer } from './modelViewer.js';

export function showModelLightbox(glbFile) {
    const lightbox = document.createElement('div');
    lightbox.className = 'model-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', '3D model viewer');
    document.body.appendChild(lightbox);

    const closeButton = document.createElement('button');
    closeButton.className = 'model-lightbox-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close 3D model viewer');
    lightbox.appendChild(closeButton);

    const viewerContainer = document.createElement('div');
    viewerContainer.className = 'model-viewer-container';
    lightbox.appendChild(viewerContainer);

    const viewer = new ModelViewer(viewerContainer);
    viewer.loadModel(`/imgs/${glbFile}`);

    const handleResize = () => viewer.resize();
    const handleKeyup = (e) => { if (e.key === 'Escape') close(); };
    const handleBackdrop = (e) => { if (e.target === lightbox) close(); };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keyup', handleKeyup);
    lightbox.addEventListener('click', handleBackdrop);
    closeButton.addEventListener('click', close);

    const previouslyFocused = document.activeElement;
    closeButton.focus();

    function close() {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keyup', handleKeyup);
        viewer.destroy();
        lightbox.remove();
        if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }
}
