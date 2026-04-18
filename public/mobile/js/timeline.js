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
import { debounce, prefersReducedMotion } from './utils.js';
import { TimelineGroup } from './timelineGroup.js';

export class Timeline {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.status = document.getElementById('timeline-status');
        this.groups = [];
        this.initialize();
    }

    async initialize() {
        try {
            await this.fetchImageGroups();
            if (!this.imageGroups.length) {
                this.showStatus('No drawings yet', true);
                return;
            }
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Failed to initialize timeline:', error);
            this.showStatus('Could not load gallery', true);
        }
    }

    showStatus(text, isError) {
        if (!this.status) return;
        this.status.classList.toggle('timeline-status--error', !!isError);
        this.status.querySelector('span:last-child').textContent = text;
        this.status.style.display = '';
    }

    hideStatus() {
        if (this.status) this.status.style.display = 'none';
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
        const viewportHeight = this.container.clientHeight;
        const viewportWidth = this.container.clientWidth;

        const minHeight = Math.max(viewportHeight, this.imageGroups.length * MIN_GROUP_SPACING);
        const height = minHeight - margin.top - margin.bottom;
        const width = viewportWidth - margin.left - margin.right;

        d3.select(`#${this.containerId}`).selectAll('svg').remove();

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

        const axisG = svg.append('g')
            .attr('class', 'time-axis')
            .attr('transform', `translate(${width / 2},0)`)
            .call(timeAxis);

        axisG.selectAll('text')
            .attr('x', AXIS_LABEL_X_OFFSET)
            .style('text-anchor', 'end');

        return axisG;
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

        if (prefersReducedMotion()) return;

        const totalLength = path.node().getTotalLength();
        path
            .attr('stroke-dasharray', totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(LIFELINE_DRAW_DURATION)
            .ease(d3.easeQuadOut)
            .attr('stroke-dashoffset', 0);
    }

    calculateGroupPositions(yScale, sizeScale, width) {
        const centerX = width / 2;
        const nodes = this.imageGroups.map((group, index) => {
            const y = yScale(new Date(group.centerDate));
            const radius = sizeScale(group.size);
            return { index, x: centerX, y, fy: y, radius, group };
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
            };
        });
        return positions;
    }

    render() {
        this.cleanup();

        const config = this.createTimelineSVG();
        const { svg, margin, width, height } = config;
        const { yScale, sizeScale } = this.createScales(width, height);

        const positions = this.calculateGroupPositions(yScale, sizeScale, width);

        const axisG = this.addTimeAxis(svg, yScale, width);
        this.addLifeline(svg, positions);

        this.marginTop = margin.top;
        this.groups = this.imageGroups.map((data, index) =>
            new TimelineGroup(data, index, positions[index], svg)
        );

        this.tickInfo = axisG.selectAll('.tick').nodes().map(node => ({
            node,
            text: node.querySelector('text'),
            line: node.querySelector('line'),
            y: parseTickY(node),
        }));

        this.hideStatus();
        this.attachScrollFocus();
        this.startTickLoop();
    }

    startTickLoop() {
        // One rAF drives pulse/wobble/boundary for every group. Previously each
        // TimelineGroup scheduled its own rAF (27 callbacks/frame); folding them
        // into a single loop cuts scheduler overhead and keeps writes batched.
        this.tickLoopStopped = false;
        const tick = (now) => {
            if (this.tickLoopStopped) return;
            for (const g of this.groups) g.tick(now);
            this.tickRaf = requestAnimationFrame(tick);
        };
        this.tickRaf = requestAnimationFrame(tick);
    }

    cleanup() {
        this.tickLoopStopped = true;
        if (this.tickRaf) {
            cancelAnimationFrame(this.tickRaf);
            this.tickRaf = null;
        }
        this.groups.forEach(group => group.destroy());
        this.groups = [];
        if (this.scrollHandler) {
            this.container.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
    }

    attachScrollFocus() {
        const update = () => {
            const viewportHeight = this.container.clientHeight;
            const scrollTop = this.container.scrollTop;
            const focalY = scrollTop + viewportHeight / 2;
            const falloff = viewportHeight * FOCAL_FALLOFF_FRACTION;

            // Group focal: distance from viewport center in svg-space (no layout reads).
            this.groups.forEach(g => {
                const groupY = this.marginTop + g.position.y;
                const t = Math.min(1, Math.abs(groupY - focalY) / falloff);
                g.setFocalScale(FOCAL_MAX - FOCAL_RANGE * t);
            });

            // Axis tick focal: same distance model applied to pre-parsed tick Y positions.
            if (this.tickInfo) {
                for (const tick of this.tickInfo) {
                    const tickY = this.marginTop + tick.y;
                    const k = Math.min(1, Math.abs(tickY - focalY) / falloff);
                    const scale = AXIS_FOCAL_MAX - AXIS_FOCAL_RANGE * k;
                    const lineOpacity = AXIS_LINE_OPACITY_MIN + (1 - AXIS_LINE_OPACITY_MIN) * (1 - k);
                    if (tick.text) tick.text.setAttribute('transform', `scale(${scale})`);
                    if (tick.line) tick.line.style.opacity = lineOpacity;
                }
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
        this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
        setTimeout(update, SCROLL_FOCUS_INIT_DELAY);
    }

    setupEventListeners() {
        const debouncedRender = debounce(() => this.render(), RESIZE_DEBOUNCE_MS);
        window.addEventListener('resize', debouncedRender);
        window.addEventListener('orientationchange', debouncedRender);
    }
}

// d3 sets "translate(0,Y)" on tick groups; parse once so we can reuse Y during scroll.
function parseTickY(tickNode) {
    const m = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(tickNode.getAttribute('transform') || '');
    return m ? parseFloat(m[1]) : 0;
}
