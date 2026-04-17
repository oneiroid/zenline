import moment from 'moment';
import {
    ENTRANCE_STAGGER,
    ENTRANCE_DURATION,
    ENTRANCE_OVERSHOOT,
    LABEL_ENTRANCE_DELAY,
    LABEL_ENTRANCE_DURATION,
    PULSE_PERIOD_MIN,
    PULSE_PERIOD_MAX,
    PULSE_MIN,
    PULSE_MAX,
    PULSE_PEAK_THRESHOLD,
    PULSE_TROUGH_THRESHOLD,
    BOUNDARY_EXPANSION,
    BOUNDARY_GROWTH_POWER,
    BOUNDARY_FADE_POWER,
    WOBBLE_PERIOD_MIN,
    WOBBLE_PERIOD_MAX,
    WOBBLE_AMPLITUDE_PX,
    WOBBLE_ROTATION_DEG,
    GRID_DIM,
    GRID_CELL_INSET,
    MORPH_OUT_DURATION,
    MORPH_IN_DURATION,
    MORPH_CELL_STAGGER_OUT,
    MORPH_CELL_STAGGER_IN,
    MORPH_SINGLE_FADE_DELAY,
    MORPH_SINGLE_FADE_DURATION,
    TAP_SCALE,
    PALETTE,
} from './constants.js';
import { prefersReducedMotion, shuffle } from './utils.js';
import { showGroupView } from './groupView.js';

const GRID_CELLS = GRID_DIM * GRID_DIM;

export class TimelineGroup {
    constructor(data, index, position, container) {
        this.data = data;
        this.index = index;
        this.position = position;
        this.container = container;
        this.reducedMotion = prefersReducedMotion();
        this.focalScale = 1;
        this.pulseScale = 1;
        this.tapScale = 1;
        this.wobbleX = 0;
        this.wobbleY = 0;
        this.wobbleRot = 0;
        this.pulseRaf = null;
        this.gridShown = false;
        this.singleImage = null;
        this.gridImages = [];
        this.initialize();
    }

    initialize() {
        const ariaLabel = `${this.formatDateRange()}, ${this.data.images.length} drawings`;
        this.group = this.container
            .append('g')
            .attr('class', 'timeline-group')
            .attr('transform', `translate(${this.position.x},${this.position.y})`)
            .attr('role', 'button')
            .attr('tabindex', '0')
            .attr('aria-label', ariaLabel);

        this.scaleGroup = this.group.append('g');

        if (this.reducedMotion) {
            this.scaleGroup.attr('transform', 'scale(1)').style('opacity', 1);
        } else {
            this.scaleGroup
                .attr('transform', 'scale(0)')
                .style('opacity', 0)
                .transition()
                .delay(this.index * ENTRANCE_STAGGER)
                .duration(ENTRANCE_DURATION)
                .ease(d3.easeBackOut.overshoot(ENTRANCE_OVERSHOOT))
                .attr('transform', 'scale(1)')
                .style('opacity', 1)
                .on('end', () => this.startPulse());
        }

        this.boundaryCircle = this.scaleGroup.append('circle')
            .attr('r', this.position.radius)
            .attr('class', 'timeline-group-background')
            .style('fill', '#ffffff')
            .style('stroke', PALETTE.circle_stroke)
            .style('stroke-width', '2.5px');

        this.labelEl = this.group.append('text')
            .attr('class', 'timeline-group-label')
            .attr('y', this.position.radius + 20)
            .attr('text-anchor', 'middle')
            .style('opacity', this.reducedMotion ? 1 : 0);

        this.labelEl.append('tspan')
            .attr('x', 0)
            .text(this.formatDateRange());

        this.labelEl.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .style('font-weight', '300')
            .style('font-size', '10px')
            .text(`${this.data.images.length} drawings`);

        if (!this.reducedMotion) {
            this.labelEl.transition()
                .delay(this.index * ENTRANCE_STAGGER + LABEL_ENTRANCE_DELAY)
                .duration(LABEL_ENTRANCE_DURATION)
                .style('opacity', 1);
        }

        this.imageContainer = this.scaleGroup.append('g')
            .attr('class', 'thumbnail-container');

        this.group.append('defs')
            .append('clipPath')
            .attr('id', `clip-${this.index}`)
            .append('circle')
            .attr('r', this.position.radius);

        this.singleImage = this.createSingleImage(1);

        this.group
            .style('cursor', 'pointer')
            .on('touchstart', () => this.setTap(TAP_SCALE), { passive: true })
            .on('touchend', () => this.setTap(1), { passive: true })
            .on('touchcancel', () => this.setTap(1), { passive: true })
            .on('click', () => this.onClick())
            .on('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.onClick();
                }
            });

        // Random phase so groups don't pulse in sync
        this.pulsePeriod = PULSE_PERIOD_MIN + Math.random() * (PULSE_PERIOD_MAX - PULSE_PERIOD_MIN);
        this.pulsePhase = Math.random() * Math.PI * 2;

        // Wobble has its own independent period + phase per axis
        this.wobblePeriod = WOBBLE_PERIOD_MIN + Math.random() * (WOBBLE_PERIOD_MAX - WOBBLE_PERIOD_MIN);
        this.wobblePhaseX = Math.random() * Math.PI * 2;
        this.wobblePhaseY = Math.random() * Math.PI * 2;
        this.wobblePhaseRot = Math.random() * Math.PI * 2;

        this.startTime = performance.now();

        // Entrance transition would normally kick off startPulse; in reduced-motion skip entrance and start now.
        if (this.reducedMotion) this.startPulse();
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

    setFocalScale(scale) {
        this.focalScale = scale;
        this.applyTransform();
    }

    setTap(scale) {
        this.tapScale = scale;
        this.applyTransform();
    }

    applyTransform() {
        const s = this.focalScale * this.pulseScale * this.tapScale;
        // translate then rotate then scale: wobble is in unscaled px relative to the group origin
        this.scaleGroup.attr(
            'transform',
            `translate(${this.wobbleX},${this.wobbleY}) rotate(${this.wobbleRot}) scale(${s})`
        );
    }

    startPulse() {
        if (this.reducedMotion) return;

        const TWO_PI = Math.PI * 2;
        const tick = (now) => {
            const elapsed = now - this.startTime;

            // Pulse wave 0..1
            const pulseT = elapsed / this.pulsePeriod;
            const wave = (Math.sin(pulseT * TWO_PI + this.pulsePhase) + 1) / 2;
            this.pulseScale = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * wave;

            // Boundary races ahead of pulse with quadratic growth + accelerating fade.
            // At wave=0 (trough): full-opacity base radius. At wave=1 (peak): expanded + invisible.
            const expansion = 1 + Math.pow(wave, BOUNDARY_GROWTH_POWER) * BOUNDARY_EXPANSION;
            const opacity = Math.pow(1 - wave, BOUNDARY_FADE_POWER);
            this.boundaryCircle
                .attr('r', this.position.radius * expansion)
                .style('opacity', opacity);

            // Wobble — three independent sine waves (x, y, rotation) with random phases
            const wobbleT = elapsed / this.wobblePeriod;
            this.wobbleX = Math.sin(wobbleT * TWO_PI + this.wobblePhaseX) * WOBBLE_AMPLITUDE_PX;
            this.wobbleY = Math.cos(wobbleT * TWO_PI + this.wobblePhaseY) * WOBBLE_AMPLITUDE_PX;
            this.wobbleRot = Math.sin(wobbleT * TWO_PI + this.wobblePhaseRot) * WOBBLE_ROTATION_DEG;

            this.applyTransform();

            if (wave > PULSE_PEAK_THRESHOLD && !this.gridShown) {
                this.morphToGrid();
            } else if (wave < PULSE_TROUGH_THRESHOLD && this.gridShown) {
                this.morphToSingle();
            }

            this.pulseRaf = requestAnimationFrame(tick);
        };
        this.pulseRaf = requestAnimationFrame(tick);
    }

    stopPulse() {
        if (this.pulseRaf) {
            cancelAnimationFrame(this.pulseRaf);
            this.pulseRaf = null;
        }
    }

    createSingleImage(opacity) {
        const img = this.getRandomImage();
        const r = this.position.radius;
        return this.imageContainer.append('image')
            .attr('class', 'tg-single')
            .attr('x', -r).attr('y', -r)
            .attr('width', r * 2).attr('height', r * 2)
            .attr('clip-path', `url(#clip-${this.index})`)
            .attr('preserveAspectRatio', 'xMidYMid slice')
            .attr('xlink:href', `/imgs/${img.filename}`)
            .style('opacity', opacity);
    }

    morphToGrid() {
        this.gridShown = true;
        const r = this.position.radius;
        const cellSize = (r * 2) / GRID_DIM;
        const inset = GRID_CELL_INSET;

        if (this.singleImage) {
            this.singleImage
                .transition().duration(MORPH_OUT_DURATION).ease(d3.easeCubicInOut)
                .style('opacity', 0)
                .remove();
            this.singleImage = null;
        }

        const picks = this.getRandomPreviewImages(GRID_CELLS);
        this.gridImages = picks.map((img, i) => {
            const row = Math.floor(i / GRID_DIM);
            const col = i % GRID_DIM;
            const x = -r + col * cellSize + inset;
            const y = -r + row * cellSize + inset;
            const size = cellSize - inset * 2;
            const cell = this.imageContainer.append('image')
                .attr('class', 'tg-grid-cell')
                .attr('x', x + size / 2).attr('y', y + size / 2)
                .attr('width', 0).attr('height', 0)
                .attr('clip-path', `url(#clip-${this.index})`)
                .attr('preserveAspectRatio', 'xMidYMid slice')
                .attr('xlink:href', `/imgs/${img.filename}`)
                .style('opacity', 0);

            cell.transition()
                .delay(i * MORPH_CELL_STAGGER_OUT)
                .duration(MORPH_OUT_DURATION)
                .ease(d3.easeCubicOut)
                .attr('x', x).attr('y', y)
                .attr('width', size).attr('height', size)
                .style('opacity', 1);

            return cell;
        });
    }

    morphToSingle() {
        this.gridShown = false;
        this.gridImages.forEach((cell, i) => {
            const cx = +cell.attr('x') + (+cell.attr('width')) / 2;
            const cy = +cell.attr('y') + (+cell.attr('height')) / 2;
            cell.transition()
                .delay(i * MORPH_CELL_STAGGER_IN)
                .duration(MORPH_IN_DURATION)
                .ease(d3.easeCubicIn)
                .attr('x', cx).attr('y', cy)
                .attr('width', 0).attr('height', 0)
                .style('opacity', 0)
                .remove();
        });
        this.gridImages = [];

        this.singleImage = this.createSingleImage(0);
        this.singleImage.transition()
            .delay(MORPH_SINGLE_FADE_DELAY)
            .duration(MORPH_SINGLE_FADE_DURATION)
            .ease(d3.easeCubicOut)
            .style('opacity', 1);
    }

    getRandomImage() {
        return this.data.images[Math.floor(Math.random() * this.data.images.length)];
    }

    getRandomPreviewImages(count) {
        const pool = shuffle(this.data.images.slice());
        const picks = pool.slice(0, Math.min(count, pool.length));
        while (picks.length < count) {
            picks.push(pool[picks.length % pool.length]);
        }
        return picks;
    }

    onClick() {
        showGroupView(this.data);
    }

    destroy() {
        this.stopPulse();
        this.group.remove();
    }
}
