import moment from 'moment';
import {
    TRANSITION_DURATION,
    MIN_ROTATION_DELAY,
    MAX_ADDITIONAL_DELAY,
    PREVIEW_GRID_SIZE,
    PREVIEW_THUMBNAIL_SIZE,
    ENTRANCE_STAGGER,
    PALETTE,
} from './constants.js';
import { showGroupView } from './groupView.js';

export class TimelineGroup {
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

        this.scaleGroup = this.group.append('g')
            .attr('transform', 'scale(0)')
            .style('opacity', 0);

        this.scaleGroup.transition()
            .delay(this.index * ENTRANCE_STAGGER)
            .duration(600)
            .ease(d3.easeBackOut.overshoot(1.2))
            .attr('transform', 'scale(1)')
            .style('opacity', 1);

        this.scaleGroup.append('circle')
            .attr('r', this.position.radius)
            .attr('class', 'timeline-group-background')
            .style('fill', '#ffffff')
            .style('stroke', PALETTE.circle_stroke)
            .style('stroke-width', '2.5px')
            .style('cursor', 'pointer');

        this.labelEl = this.group.append('text')
            .attr('class', 'timeline-group-label')
            .attr('y', this.position.radius + 18)
            .attr('text-anchor', 'middle')
            .style('opacity', 0);

        this.labelEl.append('tspan')
            .attr('x', 0)
            .text(this.formatDateRange());

        this.labelEl.append('tspan')
            .attr('x', 0)
            .attr('dy', '1.2em')
            .style('font-weight', '300')
            .style('font-size', '10px')
            .text(`${this.data.images.length} drawings`);

        this.labelEl.transition()
            .delay(this.index * ENTRANCE_STAGGER + 400)
            .duration(400)
            .style('opacity', 1);

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

        const filterId = `preview-shadow-${this.index}`;
        const filter = this.group.append('defs').append('filter')
            .attr('id', filterId)
            .attr('x', '-20%').attr('y', '-20%')
            .attr('width', '140%').attr('height', '140%');
        filter.append('feDropShadow')
            .attr('dx', 0).attr('dy', 4)
            .attr('stdDeviation', 12)
            .attr('flood-color', 'rgba(107, 94, 80, 0.2)');

        this.previewBg = this.previewContainer.append('g')
            .attr('filter', `url(#${filterId})`)
            .style('opacity', 0);

        this.previewBg.append('rect')
            .attr('x', cardX)
            .attr('y', cardY)
            .attr('width', bgWidth)
            .attr('height', bgHeight)
            .attr('rx', 14)
            .style('fill', 'rgba(255, 255, 255, 0.97)');

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

            const outerG = this.previewContainer.append('g')
                .attr('transform', `translate(${cx},${cy})`);

            const innerG = outerG.append('g')
                .attr('transform', 'scale(0)')
                .style('opacity', 0);

            innerG.append('rect')
                .attr('x', -thumbSize / 2)
                .attr('y', -thumbSize / 2)
                .attr('width', thumbSize)
                .attr('height', thumbSize)
                .attr('rx', 8)
                .style('fill', '#f5efe8');

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

        this.scaleGroup.transition()
            .duration(350)
            .ease(d3.easeCubicOut)
            .attr('transform', isHovered ? 'scale(1.08)' : 'scale(1)');

        if (this.previewBg) {
            this.previewBg.transition()
                .duration(isHovered ? 250 : 200)
                .style('opacity', isHovered ? 1 : 0);
        }

        this.previewGroups.forEach((pg, i) => {
            pg.transition()
                .duration(isHovered ? 300 : 150)
                .delay(isHovered ? 50 + i * 30 : 0)
                .ease(isHovered ? d3.easeBackOut.overshoot(1.4) : d3.easeCubicIn)
                .attr('transform', isHovered ? 'scale(1)' : 'scale(0)')
                .style('opacity', isHovered ? 1 : 0);
        });

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
