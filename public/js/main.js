import { Timeline } from './timeline.js';

const timeline = new Timeline('timeline');

document.getElementById('back-to-timeline').addEventListener('click', () => {
    document.getElementById('group-view').classList.remove('active');
    document.getElementById('timeline-view').classList.add('active');
});

export { timeline };
