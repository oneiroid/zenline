// Import required libraries
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import moment from 'moment';

// Constants
const TRANSITION_DURATION = 2000;
const MIN_ROTATION_DELAY = 3000;
const MAX_ADDITIONAL_DELAY = 4000;
const PREVIEW_GRID_SIZE = 3;
const PREVIEW_THUMBNAIL_SIZE = 80;
const ENTRANCE_STAGGER = 60; // ms between each circle appearing

// Warm palette
const PALETTE = {
    bg: '#fdf8f3',
    circle_stroke: '#d4c4b0',
    circle_stroke_hover: '#b8a99a',
    label: '#b8a99a',
    label_hover: '#6b5e50',
    lifeline: '#d4c4b0',
    lifeline_start: '#e8d5c4',
    lifeline_end: '#c4b0a0',
};

// ── 3D Model Viewer ──────────────────────────

class ModelViewer {
    constructor(container) {
        this.container = container;
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 20);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 5;
        this.renderer.setClearColor(0xdddddd);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.animate();
    }

    animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    loadModel(url) {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            while (this.scene.children.length > 0) {
                this.scene.remove(this.scene.children[0]);
            }

            const model = gltf.scene;
            this.scene.add(model);

            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            model.scale.multiplyScalar(scale);
            model.position.sub(center.multiplyScalar(scale));

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(0, 1, 1);
            this.scene.add(directionalLight);
        });
    }

    resize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}

// ── Timeline Group (single circle node) ──────

class TimelineGroup {
    constructor(data, index, position, container) {
        this.data = data;
        this.index = index;
        this.position = position;
        this.container = container;
        this.currentImage = null;
        this.rotationInterval = null;
        this.previewGroups = [];
        this.initialize();
    }

    initialize() {
        this.group = this.container
            .append('g')
            .attr('class', 'timeline-group')
            .attr('transform', `translate(${this.position.x},${this.position.y})`);

        // Scale wrapper for hover + entrance animation
        this.scaleGroup = this.group.append('g')
            .attr('transform', 'scale(0)')
            .style('opacity', 0);

        // Entrance animation — staggered pop-in
        this.scaleGroup.transition()
            .delay(this.index * ENTRANCE_STAGGER)
            .duration(600)
            .ease(d3.easeBackOut.overshoot(1.2))
            .attr('transform', 'scale(1)')
            .style('opacity', 1);

        // Background circle
        this.scaleGroup.append('circle')
            .attr('r', this.position.radius)
            .attr('class', 'timeline-group-background')
            .style('fill', '#ffffff')
            .style('stroke', PALETTE.circle_stroke)
            .style('stroke-width', '2.5px')
            .style('cursor', 'pointer');

        // Label below circle
        this.labelEl = this.group.append('text')
            .attr('class', 'timeline-group-label')
            .attr('y', this.position.radius + 18)
            .attr('text-anchor', 'middle')
            .style('opacity', 0);

        // Date range
        this.labelEl.append('tspan')
            .attr('x', 0)
            .text(this.formatDateRange());

        // Image count on second line
        this.labelEl.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .style('font-weight', '300')
            .style('font-size', '10px')
            .text(`${this.data.images.length} drawings`);

        // Fade label in after circle appears
        this.labelEl.transition()
            .delay(this.index * ENTRANCE_STAGGER + 400)
            .duration(400)
            .style('opacity', 1);

        // Preview grid (appears on hover, connected to circle)
        this.previewContainer = this.group.append('g')
            .attr('class', 'preview-container')
            .attr('pointer-events', 'none');

        this.initializeThumbnail();
        this.initializePreviewGrid();
        this.startRotation();

        this.group
            .on('click', () => this.onClick())
            .on('mouseenter', () => this.onHover(true))
            .on('mouseleave', () => this.onHover(false));
    }

    formatDateRange() {
        const start = moment(this.data.startDate);
        const end = moment(this.data.endDate);
        if (start.isSame(end, 'month')) {
            return start.format('MMM YYYY');
        }
        if (start.isSame(end, 'year')) {
            return `${start.format('MMM')} – ${end.format('MMM YYYY')}`;
        }
        return `${start.format('MMM YY')} – ${end.format('MMM YY')}`;
    }

    initializeThumbnail() {
        this.imageContainer = this.scaleGroup.append('g')
            .attr('class', 'thumbnail-container');

        this.group.append('defs')
            .append('clipPath')
            .attr('id', `clip-${this.index}`)
            .append('circle')
            .attr('r', this.position.radius);

        this.setNewImage();
    }

    setNewImage(transition = false) {
        const newImageData = this.getRandomImage();
        const newImage = this.createImageElement(newImageData);

        if (transition && this.currentImage) {
            newImage.style('opacity', 0);
            newImage
                .transition()
                .duration(TRANSITION_DURATION)
                .style('opacity', 1)
                .on('end', () => {
                    if (this.currentImage) {
                        this.currentImage.remove();
                        this.currentImage = newImage;
                    }
                });
        } else {
            newImage.style('opacity', 1);
            if (this.currentImage) {
                this.currentImage.remove();
            }
            this.currentImage = newImage;
        }
    }

    createImageElement(imagePath) {
        return this.imageContainer.append('image')
            .attr('x', -this.position.radius)
            .attr('y', -this.position.radius)
            .attr('width', this.position.radius * 2)
            .attr('height', this.position.radius * 2)
            .attr('clip-path', `url(#clip-${this.index})`)
            .attr('preserveAspectRatio', 'xMidYMid slice')
            .attr('xlink:href', `/imgs/${imagePath.filename}`);
    }

    getRandomImage() {
        return this.data.images[Math.floor(Math.random() * this.data.images.length)];
    }

    startRotation() {
        const rotationDelay = MIN_ROTATION_DELAY + Math.random() * MAX_ADDITIONAL_DELAY;
        this.rotationInterval = setInterval(() => this.setNewImage(true), rotationDelay);
    }

    stopRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
        }
    }

    initializePreviewGrid() {
        const gridSize = Math.min(PREVIEW_GRID_SIZE, Math.ceil(Math.sqrt(this.data.images.length)));
        const thumbSize = PREVIEW_THUMBNAIL_SIZE;
        const gap = 5;
        const padding = 10;
        const numToShow = Math.min(gridSize * gridSize, this.data.images.length);
        const numCols = gridSize;
        const numRows = Math.ceil(numToShow / numCols);
        const totalGridWidth = numCols * thumbSize + (numCols - 1) * gap;
        const totalGridHeight = numRows * thumbSize + (numRows - 1) * gap;
        const remaining = this.data.images.length - numToShow;
        const moreLabelHeight = remaining > 0 ? 22 : 0;
        const bgWidth = totalGridWidth + padding * 2;
        const bgHeight = totalGridHeight + padding * 2 + moreLabelHeight;
        const arrowSize = 8;

        // Smart positioning: flip below only if not enough room above AND enough below
        const spaceAbove = this.position.y - this.position.radius;
        const spaceBelow = (this.position.areaHeight || 500) - this.position.y - this.position.radius;
        const neededHeight = bgHeight + arrowSize + 20;
        const showBelow = spaceAbove < neededHeight && spaceBelow >= neededHeight;

        const cardX = -bgWidth / 2;
        let cardY;
        if (showBelow) {
            cardY = this.position.radius + 14 + arrowSize;
        } else {
            cardY = -this.position.radius - 14 - arrowSize - bgHeight;
        }

        // SVG drop-shadow filter for the card
        const filterId = `preview-shadow-${this.index}`;
        const filter = this.group.append('defs').append('filter')
            .attr('id', filterId)
            .attr('x', '-20%').attr('y', '-20%')
            .attr('width', '140%').attr('height', '140%');
        filter.append('feDropShadow')
            .attr('dx', 0).attr('dy', 4)
            .attr('stdDeviation', 12)
            .attr('flood-color', 'rgba(107, 94, 80, 0.2)');

        // Background group: card + arrow + optional label
        this.previewBg = this.previewContainer.append('g')
            .attr('filter', `url(#${filterId})`)
            .style('opacity', 0);

        // Card rectangle
        this.previewBg.append('rect')
            .attr('x', cardX)
            .attr('y', cardY)
            .attr('width', bgWidth)
            .attr('height', bgHeight)
            .attr('rx', 14)
            .style('fill', 'rgba(255, 255, 255, 0.97)');

        // Arrow pointer connecting the card to the circle
        if (showBelow) {
            const tipY = cardY - arrowSize;
            this.previewBg.append('polygon')
                .attr('points', `0,${tipY} ${arrowSize},${cardY + 1} ${-arrowSize},${cardY + 1}`)
                .style('fill', 'rgba(255, 255, 255, 0.97)');
        } else {
            const tipY = cardY + bgHeight + arrowSize;
            this.previewBg.append('polygon')
                .attr('points', `${-arrowSize},${cardY + bgHeight - 1} ${arrowSize},${cardY + bgHeight - 1} 0,${tipY}`)
                .style('fill', 'rgba(255, 255, 255, 0.97)');
        }

        // "+N more" label when group has more images than shown
        if (remaining > 0) {
            this.previewBg.append('text')
                .attr('x', 0)
                .attr('y', cardY + padding + totalGridHeight + 16)
                .attr('text-anchor', 'middle')
                .style('font-family', "'Nunito', sans-serif")
                .style('font-size', '11px')
                .style('font-weight', '600')
                .style('fill', PALETTE.label)
                .text(`+${remaining} more`);
        }

        // Thumbnail images — each with individual clip + scale animation
        const gridStartX = cardX + padding;
        const gridStartY = cardY + padding;
        const previewImages = this.getRandomPreviewImages(numToShow);

        previewImages.forEach((img, i) => {
            const row = Math.floor(i / numCols);
            const col = i % numCols;
            const x = gridStartX + col * (thumbSize + gap);
            const y = gridStartY + row * (thumbSize + gap);
            const cx = x + thumbSize / 2;
            const cy = y + thumbSize / 2;

            // Per-thumbnail rounded clip path
            const clipId = `preview-clip-${this.index}-${i}`;
            this.group.append('defs')
                .append('clipPath')
                .attr('id', clipId)
                .append('rect')
                .attr('x', -thumbSize / 2)
                .attr('y', -thumbSize / 2)
                .attr('width', thumbSize)
                .attr('height', thumbSize)
                .attr('rx', 8);

            // Outer group: static position at thumbnail center
            const outerG = this.previewContainer.append('g')
                .attr('transform', `translate(${cx},${cy})`);

            // Inner group: animated scale + opacity
            const innerG = outerG.append('g')
                .attr('transform', 'scale(0)')
                .style('opacity', 0);

            // Placeholder background
            innerG.append('rect')
                .attr('x', -thumbSize / 2)
                .attr('y', -thumbSize / 2)
                .attr('width', thumbSize)
                .attr('height', thumbSize)
                .attr('rx', 8)
                .style('fill', '#f5efe8');

            // Thumbnail image
            innerG.append('image')
                .attr('x', -thumbSize / 2)
                .attr('y', -thumbSize / 2)
                .attr('width', thumbSize)
                .attr('height', thumbSize)
                .attr('clip-path', `url(#${clipId})`)
                .attr('preserveAspectRatio', 'xMidYMid slice')
                .attr('xlink:href', `/imgs/${img.filename}`);

            this.previewGroups.push(innerG);
        });
    }

    getRandomPreviewImages(count) {
        const images = [...this.data.images];
        const result = [];
        count = Math.min(count, images.length);

        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * images.length);
            result.push(images.splice(randomIndex, 1)[0]);
        }

        return result;
    }

    onHover(isHovered) {
        if (isHovered) {
            this.group.raise();
        }

        // Circle scale
        this.scaleGroup.transition()
            .duration(350)
            .ease(d3.easeCubicOut)
            .attr('transform', isHovered ? 'scale(1.08)' : 'scale(1)');

        // Preview card background — smooth fade
        if (this.previewBg) {
            this.previewBg.transition()
                .duration(isHovered ? 250 : 200)
                .style('opacity', isHovered ? 1 : 0);
        }

        // Staggered thumbnail entrance/exit
        this.previewGroups.forEach((pg, i) => {
            pg.transition()
                .duration(isHovered ? 300 : 150)
                .delay(isHovered ? 50 + i * 30 : 0)
                .ease(isHovered ? d3.easeBackOut.overshoot(1.4) : d3.easeCubicIn)
                .attr('transform', isHovered ? 'scale(1)' : 'scale(0)')
                .style('opacity', isHovered ? 1 : 0);
        });

        // Circle stroke
        this.group.select('.timeline-group-background')
            .transition()
            .duration(350)
            .style('stroke-width', isHovered ? '3px' : '2.5px')
            .style('stroke', isHovered ? PALETTE.circle_stroke_hover : PALETTE.circle_stroke);

        if (isHovered) {
            this.stopRotation();
        } else {
            this.startRotation();
        }
    }

    onClick() {
        showGroupView(this.data);
    }

    destroy() {
        this.stopRotation();
        this.group.remove();
    }
}

// ── Timeline ─────────────────────────────────

class Timeline {
    constructor(containerId) {
        this.containerId = containerId;
        this.groups = [];
        this.initialize();
    }

    async initialize() {
        try {
            await this.fetchImageGroups();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize timeline:', error);
        }
    }

    async fetchImageGroups() {
        const response = await fetch('/data/images.json');
        if (!response.ok) throw new Error('Failed to fetch image groups');
        const data = await response.json();

        this.imageGroups = data.map(group => ({
            ...group,
            startDate: moment(group.startDate),
            endDate: moment(group.endDate),
            centerDate: moment(group.centerDate),
            images: group.images.map(img => ({
                ...img,
                date: moment(img.date)
            }))
        }));

        this.imageGroups.sort((a, b) => a.centerDate.valueOf() - b.centerDate.valueOf());
    }

    createTimelineSVG() {
        const margin = { top: 40, right: 20, bottom: 60, left: 20 };
        const container = document.getElementById(this.containerId);
        const minWidth = Math.max(container.clientWidth, this.imageGroups.length * 140);
        const width = minWidth - margin.left - margin.right;
        const height = container.clientHeight - margin.top - margin.bottom;

        d3.select(`#${this.containerId}`).html('');

        const svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Define gradient for lifeline
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'lifeline-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '100%').attr('y2', '0%');
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', PALETTE.lifeline_start);
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', PALETTE.lifeline_end);

        return { svg, margin, width, height };
    }

    createScales(width, height) {
        const timeExtent = [
            new Date(this.imageGroups[0].startDate),
            new Date(this.imageGroups.at(-1).endDate)
        ];
        const padding = (timeExtent[1] - timeExtent[0]) * 0.05;

        const xScale = d3.scaleTime()
            .domain([
                new Date(timeExtent[0] - padding),
                new Date(timeExtent[1].getTime() + padding)
            ])
            .range([0, width]);

        // Sqrt scale so area is proportional to image count (not radius)
        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(this.imageGroups, d => d.size)])
            .range([24, 72]);

        return { xScale, sizeScale };
    }

    addTimeAxis(svg, xScale, height) {
        const timeAxis = d3.axisBottom(xScale)
            .ticks(d3.timeYear.every(1))
            .tickFormat(d3.timeFormat('%Y'));

        svg.append('g')
            .attr('class', 'time-axis')
            .attr('transform', `translate(0,${height - 10})`)
            .call(timeAxis)
            .selectAll('text')
            .style('text-anchor', 'middle');
    }

    addLifeline(svg, positions) {
        if (positions.length < 2) return;

        const lineGen = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom.alpha(0.5));

        const path = svg.insert('path', ':first-child')
            .attr('class', 'timeline-lifeline')
            .attr('d', lineGen(positions));

        // Animate the lifeline drawing
        const totalLength = path.node().getTotalLength();
        path
            .attr('stroke-dasharray', totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(1500)
            .ease(d3.easeQuadOut)
            .attr('stroke-dashoffset', 0);
    }

    calculateGroupPositions(xScale, sizeScale, height) {
        const positions = [];
        const nodes = this.imageGroups.map((group, index) => {
            const radius = sizeScale(group.size);
            return {
                index,
                x: xScale(new Date(group.centerDate)),
                y: height / 2,
                radius,
                group
            };
        });

        const simulation = d3.forceSimulation(nodes)
            .force('x', d3.forceX(d => d.x).strength(0.8))
            .force('y', d3.forceY(height / 2).strength(0.05))
            .force('collision', d3.forceCollide().radius(d => d.radius * 1.5).strength(0.9))
            .stop();

        for (let i = 0; i < 300; ++i) simulation.tick();

        nodes.forEach(node => {
            positions[node.index] = {
                x: node.x,
                y: Math.max(node.radius + 10, Math.min(height - node.radius - 50, node.y)),
                radius: node.radius,
                areaHeight: height
            };
        });

        return positions;
    }

    render() {
        this.cleanup();

        const config = this.createTimelineSVG();
        const { svg, width, height } = config;
        const { xScale, sizeScale } = this.createScales(width, height);

        const positions = this.calculateGroupPositions(xScale, sizeScale, height);

        // Draw lifeline through all group centers
        this.addLifeline(svg, positions);

        // Create group circles
        this.groups = this.imageGroups.map((data, index) =>
            new TimelineGroup(data, index, positions[index], svg)
        );

        this.addTimeAxis(svg, xScale, height);
    }

    cleanup() {
        this.groups.forEach(group => group.destroy());
        this.groups = [];
    }

    setupEventListeners() {
        const debouncedRender = debounce(() => this.render(), 250);
        window.addEventListener('resize', debouncedRender);

        // Convert vertical mouse wheel to horizontal scroll on the timeline
        const container = document.getElementById(this.containerId);
        container.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
}

// ── Group View ───────────────────────────────

function showGroupView(group) {
    document.getElementById('timeline-view').classList.remove('active');

    const groupView = document.getElementById('group-view');
    groupView.classList.add('active');

    // Set header info
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

    // Sort images by date within the group
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

    // Scroll to top
    groupView.scrollTop = 0;
}

// ── 3D Model Lightbox ────────────────────────

function showModelLightbox(glbFile) {
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

// ── Helpers ──────────────────────────────────

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export { Timeline, showGroupView, showModelLightbox };
