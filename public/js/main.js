import { Timeline } from './timeline.js';

const timeline = new Timeline('timeline');

document.getElementById('back-to-timeline').addEventListener('click', () => {
    const timelineView = document.getElementById('timeline-view');
    const groupView = document.getElementById('group-view');
    groupView.classList.remove('active');
    groupView.setAttribute('aria-hidden', 'true');
    timelineView.classList.add('active');
    timelineView.setAttribute('aria-hidden', 'false');
});

export { timeline };
