import moment from 'moment';
import { PALETTE } from './constants.js';
import { debounce } from './utils.js';
import { TimelineGroup } from './timelineGroup.js';

export class Timeline {
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

        this.addLifeline(svg, positions);

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

        const container = document.getElementById(this.containerId);
        container.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
}
