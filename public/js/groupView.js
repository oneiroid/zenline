import moment from 'moment';
import { showModelLightbox } from './modelLightbox.js';

export function showGroupView(group) {
    const timelineView = document.getElementById('timeline-view');
    const groupView = document.getElementById('group-view');

    timelineView.classList.remove('active');
    timelineView.setAttribute('aria-hidden', 'true');
    groupView.classList.add('active');
    groupView.setAttribute('aria-hidden', 'false');

    document.getElementById('group-view-title').textContent = formatRange(group);
    document.getElementById('group-view-count').textContent = `${group.images.length} drawings`;

    const container = document.getElementById('group-images');
    container.innerHTML = '';

    const sortedImages = [...group.images].sort((a, b) =>
        moment(a.date).valueOf() - moment(b.date).valueOf()
    );

    const fragment = document.createDocumentFragment();
    sortedImages.forEach((img, i) => {
        fragment.appendChild(createImageCard(img, i));
    });
    container.appendChild(fragment);

    groupView.scrollTop = 0;
}

function formatRange(group) {
    const start = moment(group.startDate);
    const end = moment(group.endDate);
    if (start.isSame(end, 'month')) return start.format('MMMM YYYY');
    if (start.isSame(end, 'year')) return `${start.format('MMMM')} – ${end.format('MMMM YYYY')}`;
    return `${start.format('MMM YYYY')} – ${end.format('MMM YYYY')}`;
}

function createImageCard(img, i) {
    const wrapper = document.createElement('div');
    wrapper.className = 'group-image-wrapper';
    wrapper.style.animationDelay = `${i * 40}ms`;

    const anchor = document.createElement('a');
    const dateLabel = moment(img.date).format('MMMM D, YYYY');

    if (img.glbFile) {
        anchor.href = '#';
        anchor.setAttribute('aria-label', `View 3D model from ${dateLabel}`);
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            showModelLightbox(img.glbFile);
        });

        const badge = document.createElement('span');
        badge.className = 'group-image-3d-badge';
        badge.textContent = '3D';
        badge.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(badge);
    } else {
        anchor.href = `/imgs/${img.filename}`;
        anchor.setAttribute('data-lightbox', 'group');
        anchor.setAttribute('data-title', dateLabel);
        anchor.setAttribute('aria-label', `View drawing from ${dateLabel}`);
    }

    const image = document.createElement('img');
    image.src = `/imgs/${img.filename}`;
    image.className = 'group-image';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = `Drawing from ${dateLabel}`;

    const dateEl = document.createElement('div');
    dateEl.className = 'group-image-date';
    dateEl.textContent = moment(img.date).format('MMM D, YYYY');

    anchor.appendChild(image);
    wrapper.appendChild(anchor);
    wrapper.appendChild(dateEl);
    return wrapper;
}
