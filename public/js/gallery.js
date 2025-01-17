// Constants
const TRANSITION_DURATION = 2000;
const MIN_ROTATION_DELAY = 3000;
const MAX_ADDITIONAL_DELAY = 4000;
const PREVIEW_GRID_SIZE = 3; // Number of thumbnails in preview grid (3x3)
const PREVIEW_THUMBNAIL_SIZE = 100; // Size of each preview thumbnail

class TimelineGroup {
    constructor(data, index, position, container) {
        this.data = data;
        this.index = index;
        this.position = position;
        this.container = container;
        this.currentImage = null;
        this.rotationInterval = null;
        this.previewThumbnails = [];
        this.initialize();
    }

    initialize() {
        this.group = this.container
            .append('g')
            .attr('class', 'timeline-group')
            .attr('transform', `translate(${this.position.x},${this.position.y})`);

        // Create a container for scale transitions
        this.scaleGroup = this.group.append('g');

        // Add background circle
        this.scaleGroup.append('circle')
            .attr('r', this.position.radius)
            .attr('class', 'timeline-group-background')
            .style('fill', '#ffffff')
            .style('stroke', '#999')
            .style('stroke-width', '4px')
            .style('cursor', 'pointer');

        // Add label
        this.group.append('text')
            .attr('class', 'timeline-group-label')
            .attr('y', this.position.radius + 20)
            .attr('text-anchor', 'middle')
            .text(`${this.data.dateRange} (${this.data.images.length})`);

        // Initialize preview grid container
        this.previewContainer = this.group.append('g')
            .attr('class', 'preview-container')
            .style('opacity', 0)
            .attr('pointer-events', 'none');

        // Initialize thumbnail system
        this.initializeThumbnail();
        this.initializePreviewGrid();
        this.startRotation();

        // Add hover and click handlers
        this.group
            .on('click', () => this.onClick())
            .on('mouseenter', () => this.onHover(true))
            .on('mouseleave', () => this.onHover(false));
    }

    initializeThumbnail() {
        // Create main image container inside scale group
        this.imageContainer = this.scaleGroup.append('g')
            .attr('class', 'thumbnail-container');

        // Add clip path
        const clipPath = this.group.append('defs')
            .append('clipPath')
            .attr('id', `clip-${this.index}`)
            .append('circle')
            .attr('r', this.position.radius);

        // Set initial image
        this.setNewImage();
    }

    setNewImage(transition = false) {
        const newImageData = this.getRandomImage();
        const newImage = this.createImageElement(newImageData);

        if (transition && this.currentImage) {
            // Start new image fully transparent
            newImage.style('opacity', 0);
            newImage
                .transition()
                .duration(TRANSITION_DURATION)
                .style('opacity', 1)
                .on('end', () => {
                    if(this.currentImage) {
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
        const totalWidth = gridSize * PREVIEW_THUMBNAIL_SIZE;
        const startX = -totalWidth / 2;
        const startY = -this.position.radius - totalWidth - 20;

        this.previewContainer.append('rect')
            .attr('width', totalWidth)
            .attr('height', totalWidth)
            .attr('transform', `translate(${startX},${startY})`)
            .style('fill', '#ddd');

        // Create clip paths for preview thumbnails
        const previewClipPath = this.group.append('defs')
            .append('clipPath')
            .attr('id', `preview-clip-${this.index}`)
            .append('rect')
            .attr('width', PREVIEW_THUMBNAIL_SIZE - 4)
            .attr('height', PREVIEW_THUMBNAIL_SIZE - 4)
            .attr('rx', 4);

        // Select random images for preview
        const previewImages = this.getRandomPreviewImages(gridSize * gridSize);

        previewImages.forEach((img, i) => {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const x = startX + col * PREVIEW_THUMBNAIL_SIZE;
            const y = startY + row * PREVIEW_THUMBNAIL_SIZE;

            const previewGroup = this.previewContainer.append('g')
                .attr('transform', `translate(${x},${y})`);

            // Add background for thumbnail
            previewGroup.append('rect')
                .attr('width', PREVIEW_THUMBNAIL_SIZE - 4)
                .attr('height', PREVIEW_THUMBNAIL_SIZE - 4)
                .attr('rx', 4)
                .style('fill', '#fff')
                .style('stroke', '#ddd')
                .style('stroke-width', '1px');

            // Add image
            const thumbnail = previewGroup.append('image')
                .attr('width', PREVIEW_THUMBNAIL_SIZE - 4)
                .attr('height', PREVIEW_THUMBNAIL_SIZE - 4)
                .attr('clip-path', `url(#preview-clip-${this.index})`)
                .attr('preserveAspectRatio', 'xMidYMid slice')
                .attr('xlink:href', `/imgs/${img.filename}`);

            this.previewThumbnails.push(thumbnail);
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
            this.group.raise(); // Move group to the top of the rendering stack
        }

        // Scale transition
        this.scaleGroup.transition()
            .duration(300)
            .attr('transform', isHovered ? 'scale(1.1)' : 'scale(1)');

        // Preview grid transition
        this.previewContainer.transition()
            .duration(300)
            .style('opacity', isHovered ? 1 : 0);

        //this.previewContainer.style('z-index', isHovered ? 1000 : 10);

        // Style changes
        this.group.select('.timeline-group-background')
            .transition()
            .duration(300)
            .style('stroke-width', isHovered ? '5px' : '3px');

        // Stop/start rotation on hover
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
        try {
            const response = await fetch('/data/images.json');
            if (!response.ok) {
                throw new Error('Failed to fetch image groups');
            }
            const data = await response.json();
            // Convert date strings back to moment objects
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
            // Sort by center date
            this.imageGroups.sort((a, b) => a.centerDate.valueOf() - b.centerDate.valueOf());
        } catch (error) {
            console.error('Error fetching image groups:', error);
            this.imageGroups = [];
        }
    }

    createTimelineSVG() {
        const margin = { top: 20, right: 40, bottom: 60, left: 40 };
        const container = document.getElementById(this.containerId);
        const minWidth = Math.max(container.clientWidth, this.imageGroups.length * 120);
        const width = minWidth - margin.left - margin.right;
        const height = container.clientHeight - margin.top - margin.bottom;

        d3.select(`#${this.containerId}`).html('');

        const svg = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        return { svg, margin, width, height };
    }

    createScales(width, height) {
        const timeExtent = d3.extent(this.imageGroups, d => new Date(d.centerDate));
        const padding = (timeExtent[1] - timeExtent[0]) * 0.05;

        const xScale = d3.scaleTime()
            .domain([
                new Date(timeExtent[0] - padding),
                new Date(timeExtent[1] + padding)
            ])
            .range([0, width]);

        const sizeScale = d3.scaleLinear()
            .domain([0, d3.max(this.imageGroups, d => d.size)])
            .range([30, 100]);

        return { xScale, sizeScale };
    }

    addTimeAxis(svg, xScale, height) {
        const timeAxis = d3.axisBottom(xScale)
            .ticks(d3.timeMonth.every(2))
            .tickFormat(d3.timeFormat('%Y-%m'));

        svg.append('g')
            .attr('class', 'time-axis')
            .attr('transform', `translate(0,${height - 20})`)
            .call(timeAxis)
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');
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

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('x', d3.forceX(d => d.x).strength(0.9)) // Keep x position based on date
            .force('y', d3.forceY(height / 2).strength(0.01)) // Gentle force towards vertical center
            .force('collision', d3.forceCollide().radius(d => d.radius * 1.3))
            .stop();

        // Run the simulation
        for (let i = 0; i < 300; ++i) simulation.tick();

        // Convert simulation results to positions
        nodes.forEach(node => {
            positions[node.index] = {
                x: node.x,
                y: Math.max(node.radius, Math.min(height - node.radius - 40, node.y)),
                radius: node.radius
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
    }
}

function showGroupView(group) {
    document.getElementById('timeline-view').classList.remove('active');
    document.getElementById('group-view').classList.add('active');

    const container = document.getElementById('group-images');
    container.innerHTML = '';

    group.images.forEach(img => {
        const imgElement = document.createElement('a');
        imgElement.href = `/imgs/${img.filename}`;
        imgElement.setAttribute('data-lightbox', 'group');
        imgElement.setAttribute('data-title', img.filename);

        const image = document.createElement('img');
        image.src = `/imgs/${img.filename}`;
        image.className = 'group-image';

        imgElement.appendChild(image);
        container.appendChild(imgElement);
    });
}

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

// Event Listeners
document.getElementById('back-to-timeline').addEventListener('click', () => {
    document.getElementById('group-view').classList.remove('active');
    document.getElementById('timeline-view').classList.add('active');
});

// Initialize timeline
const timeline = new Timeline('timeline');