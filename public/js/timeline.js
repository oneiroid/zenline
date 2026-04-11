import moment from 'moment';
import {
    PALETTE,
    TIMELINE_MARGIN,
    MIN_GROUP_SPACING,
    RADIUS_MIN,
    RADIUS_MAX_ABS,
    RADIUS_MAX_WIDTH_FRACTION,
    DOMAIN_PADDING_FRACTION,
    SIDE_PADDING,
    FORCE_X_STRENGTH,
    COLLISION_STRENGTH,
    COLLISION_PADDING,
    SIM_TICKS,
    FOCAL_MAX,
    FOCAL_RANGE,
    FOCAL_FALLOFF_FRACTION,
    LIFELINE_DRAW_DURATION,
    LIFELINE_CURVE_ALPHA,
    RESIZE_DEBOUNCE_MS,
    SCROLL_FOCUS_INIT_DELAY,
    AXIS_LABEL_X_OFFSET,
    AXIS_FOCAL_MAX,
    AXIS_FOCAL_RANGE,
    AXIS_LINE_OPACITY_MIN,
} from './constants.js';
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
        const margin = TIMELINE_MARGIN;
        const container = document.getElementById(this.containerId);
        const viewportHeight = container.clientHeight;
        const viewportWidth = container.clientWidth;

        const minHeight = Math.max(viewportHeight, this.imageGroups.length * MIN_GROUP_SPACING);
        const height = minHeight - margin.top - margin.bottom;
        const width = viewportWidth - margin.left - margin.right;

        d3.select(`#${this.containerId}`).html('');

        const svgRoot = d3.select(`#${this.containerId}`)
            .append('svg')
            .attr('width', viewportWidth)
            .attr('height', minHeight);

        const svg = svgRoot.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'lifeline-gradient')
            .attr('x1', '0%').attr('y1', '0%')
            .attr('x2', '0%').attr('y2', '100%');
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', PALETTE.lifeline_start);
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', PALETTE.lifeline_end);

        return { svg, margin, width, height, viewportHeight };
    }

    createScales(width, height) {
        const timeExtent = [
            new Date(this.imageGroups[0].startDate),
            new Date(this.imageGroups.at(-1).endDate)
        ];
        const padding = (timeExtent[1] - timeExtent[0]) * DOMAIN_PADDING_FRACTION;

        const yScale = d3.scaleTime()
            .domain([
                new Date(timeExtent[0] - padding),
                new Date(timeExtent[1].getTime() + padding)
            ])
            .range([0, height]);

        const maxRadius = Math.min(RADIUS_MAX_ABS, width * RADIUS_MAX_WIDTH_FRACTION);
        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(this.imageGroups, d => d.size)])
            .range([RADIUS_MIN, maxRadius]);

        return { yScale, sizeScale };
    }

    addTimeAxis(svg, yScale, width) {
        const timeAxis = d3.axisLeft(yScale)
            .ticks(d3.timeYear.every(1))
            .tickFormat(d3.timeFormat('%Y'))
            .tickSize(-width);

        svg.append('g')
            .attr('class', 'time-axis')
            .attr('transform', `translate(${width / 2},0)`)
            .call(timeAxis)
            .selectAll('text')
            .attr('x', AXIS_LABEL_X_OFFSET)
            .style('text-anchor', 'end');
    }

    addLifeline(svg, positions) {
        if (positions.length < 2) return;

        const lineGen = d3.line()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveCatmullRom.alpha(LIFELINE_CURVE_ALPHA));

        const path = svg.insert('path', ':first-child')
            .attr('class', 'timeline-lifeline')
            .attr('d', lineGen(positions));

        const totalLength = path.node().getTotalLength();
        path
            .attr('stroke-dasharray', totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(LIFELINE_DRAW_DURATION)
            .ease(d3.easeQuadOut)
            .attr('stroke-dashoffset', 0);
    }

    calculateGroupPositions(yScale, sizeScale, width, height) {
        const centerX = width / 2;
        const nodes = this.imageGroups.map((group, index) => {
            const radius = sizeScale(group.size);
            return {
                index,
                x: centerX,
                y: yScale(new Date(group.centerDate)),
                fy: yScale(new Date(group.centerDate)),
                radius,
                group
            };
        });

        const simulation = d3.forceSimulation(nodes)
            .force('x', d3.forceX(centerX).strength(FORCE_X_STRENGTH))
            .force('collision', d3.forceCollide().radius(d => d.radius * COLLISION_PADDING).strength(COLLISION_STRENGTH))
            .stop();

        for (let i = 0; i < SIM_TICKS; ++i) simulation.tick();

        const positions = [];
        nodes.forEach(node => {
            positions[node.index] = {
                x: Math.max(node.radius + SIDE_PADDING, Math.min(width - node.radius - SIDE_PADDING, node.x)),
                y: node.y,
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
        const { yScale, sizeScale } = this.createScales(width, height);

        const positions = this.calculateGroupPositions(yScale, sizeScale, width, height);

        this.addTimeAxis(svg, yScale, width);
        this.addLifeline(svg, positions);

        this.groups = this.imageGroups.map((data, index) =>
            new TimelineGroup(data, index, positions[index], svg)
        );

        this.axisTicks = svg.selectAll('.time-axis .tick');
        this.attachScrollFocus();
    }

    cleanup() {
        this.groups.forEach(group => group.destroy());
        this.groups = [];
        if (this.scrollHandler) {
            const container = document.getElementById(this.containerId);
            container.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
    }

    attachScrollFocus() {
        const container = document.getElementById(this.containerId);
        const update = () => {
            const rect = container.getBoundingClientRect();
            const focalY = rect.top + rect.height / 2;
            const falloff = rect.height * FOCAL_FALLOFF_FRACTION;

            this.groups.forEach(g => {
                const node = g.group.node();
                if (!node) return;
                const gRect = node.getBoundingClientRect();
                const cy = gRect.top + gRect.height / 2;
                const dist = Math.abs(cy - focalY);
                const t = Math.min(1, dist / falloff);
                const focal = FOCAL_MAX - FOCAL_RANGE * t;
                g.setFocalScale(focal);
            });

            // Axis ticks: scale labels and modulate grid-line opacity by focal distance
            if (this.axisTicks) {
                this.axisTicks.each(function () {
                    const tickNode = this;
                    const tRect = tickNode.getBoundingClientRect();
                    const cy = tRect.top + tRect.height / 2;
                    const dist = Math.abs(cy - focalY);
                    const k = Math.min(1, dist / falloff);
                    const scale = AXIS_FOCAL_MAX - AXIS_FOCAL_RANGE * k;
                    const lineOpacity = AXIS_LINE_OPACITY_MIN + (1 - AXIS_LINE_OPACITY_MIN) * (1 - k);
                    const sel = d3.select(tickNode);
                    sel.select('text').attr('transform', `scale(${scale})`);
                    sel.select('line').style('opacity', lineOpacity);
                });
            }
        };
        let raf = null;
        this.scrollHandler = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                update();
            });
        };
        container.addEventListener('scroll', this.scrollHandler, { passive: true });
        setTimeout(update, SCROLL_FOCUS_INIT_DELAY);
    }

    setupEventListeners() {
        const debouncedRender = debounce(() => this.render(), RESIZE_DEBOUNCE_MS);
        window.addEventListener('resize', debouncedRender);
        window.addEventListener('orientationchange', debouncedRender);
    }
}
