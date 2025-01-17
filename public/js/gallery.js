// Constants
const TRANSITION_DURATION = 2000;
const MIN_ROTATION_DELAY = 3000;
const MAX_ADDITIONAL_DELAY = 4000;

class TimelineGroup {
    constructor(data, index, position, container) {
        this.data = data;
        this.index = index;
        this.position = position;
        this.container = container;
        this.currentImage = null;
        this.rotationInterval = null;
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

        // Initialize thumbnail system
        this.initializeThumbnail();
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

    onHover(isHovered) {
        // Scale transition
        this.scaleGroup.transition()
            .duration(300)
            .attr('transform', isHovered ? 'scale(1.3)' : 'scale(1)');

        // Style changes
        this.group.select('.timeline-group-background')
            .transition()
            .duration(300)
            .style('stroke-width', isHovered ? '5px' : '3px');
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
        const response = await fetch('/api/images');
        this.imageGroups = await response.json();
        this.imageGroups.sort((a, b) => new Date(a.centerDate) - new Date(b.centerDate));
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