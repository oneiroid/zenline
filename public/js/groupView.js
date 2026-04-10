import moment from 'moment';
import { showModelLightbox } from './modelLightbox.js';

export function showGroupView(group) {
    document.getElementById('timeline-view').classList.remove('active');

    const groupView = document.getElementById('group-view');
    groupView.classList.add('active');

    const start = moment(group.startDate);
    const end = moment(group.endDate);
    let rangeLabel;
    if (start.isSame(end, 'month')) {
        rangeLabel = start.format('MMMM YYYY');
    } else if (start.isSame(end, 'year')) {
        rangeLabel = `${start.format('MMMM')} – ${end.format('MMMM YYYY')}`;
    } else {
        rangeLabel = `${start.format('MMM YYYY')} – ${end.format('MMM YYYY')}`;
    }

    document.getElementById('group-view-title').textContent = rangeLabel;
    document.getElementById('group-view-count').textContent = `${group.images.length} drawings`;

    const container = document.getElementById('group-images');
    container.innerHTML = '';

    const sortedImages = [...group.images].sort((a, b) =>
        moment(a.date).valueOf() - moment(b.date).valueOf()
    );

    sortedImages.forEach((img, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'group-image-wrapper';
        wrapper.style.animationDelay = `${i * 40}ms`;

        const imgElement = document.createElement('a');
        if (img.glbFile) {
            imgElement.href = '#';
            imgElement.onclick = (e) => {
                e.preventDefault();
                showModelLightbox(img.glbFile);
            };

            const badge = document.createElement('span');
            badge.className = 'group-image-3d-badge';
            badge.textContent = '3D';
            wrapper.appendChild(badge);
        } else {
            imgElement.href = `/imgs/${img.filename}`;
            imgElement.setAttribute('data-lightbox', 'group');
            imgElement.setAttribute('data-title', moment(img.date).format('MMMM D, YYYY'));
        }

        const image = document.createElement('img');
        image.src = `/imgs/${img.filename}`;
        image.className = 'group-image';
        image.loading = 'lazy';

        const dateLabel = document.createElement('div');
        dateLabel.className = 'group-image-date';
        dateLabel.textContent = moment(img.date).format('MMM D, YYYY');

        imgElement.appendChild(image);
        wrapper.appendChild(imgElement);
        wrapper.appendChild(dateLabel);
        container.appendChild(wrapper);
    });

    groupView.scrollTop = 0;
}
