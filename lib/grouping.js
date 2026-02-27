const fs = require('fs');
const path = require('path');
const moment = require('moment');

const DEFAULT_MIN_GROUP_SIZE = 6;
const DEFAULT_MAX_MONTHS_DISTANCE = 4;

/**
 * Scan images from the given directory and group them by date.
 * Detects paired .glb files for 3D model support.
 */
function scanImages(imgDir, options = {}) {
    const MIN_GROUP_SIZE = options.minGroupSize || DEFAULT_MIN_GROUP_SIZE;
    const MAX_MONTHS_DISTANCE = options.maxMonthsDistance || DEFAULT_MAX_MONTHS_DISTANCE;

    const files = fs.readdirSync(imgDir);

    const images = files
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
        .map(file => {
            const [datePart] = file.split('.');
            const date = moment(datePart.slice(0, 7));
            const baseFileName = path.parse(file).name;
            const glbFile = files.find(f => f === `${baseFileName}.glb`);

            return {
                filename: file,
                date,
                month: date.format('YYYY-MM'),
                ...(glbFile && { glbFile })
            };
        });

    const groups = Object.entries(images.reduce((acc, img) => {
        acc[img.month] = (acc[img.month] || []).concat(img);
        return acc;
    }, {}))
        .map(([month, imgs]) => ({
            dateRange: month,
            startDate: moment(month, 'YYYY-MM'),
            endDate: moment(month, 'YYYY-MM').endOf('month'),
            centerDate: moment(month, 'YYYY-MM').add(15, 'days'),
            images: imgs,
            size: imgs.length
        }))
        .sort((a, b) => a.startDate - b.startDate);

    const mergedGroups = groups.reduce((merged, group) => {
        const lastGroup = merged[merged.length - 1];

        if (!lastGroup) {
            merged.push({ ...group });
            return merged;
        }

        const monthsDiff = group.startDate.diff(lastGroup.endDate, 'months');
        const shouldMerge = (
            lastGroup.size < MIN_GROUP_SIZE && monthsDiff <= MAX_MONTHS_DISTANCE ||
            group.size < MIN_GROUP_SIZE && monthsDiff <= MAX_MONTHS_DISTANCE ||
            monthsDiff <= MIN_GROUP_SIZE && lastGroup.size + group.size <= MIN_GROUP_SIZE * 2
        );

        if (shouldMerge) {
            lastGroup.images.push(...group.images);
            lastGroup.size = lastGroup.images.length;
            lastGroup.endDate = moment.max(lastGroup.endDate, group.endDate);
            lastGroup.centerDate = lastGroup.startDate.clone().add(lastGroup.endDate.diff(lastGroup.startDate) / 2);
            lastGroup.dateRange = `${lastGroup.startDate.format('YYYY-MM')} to ${lastGroup.endDate.format('YYYY-MM')}`;
        } else {
            merged.push({ ...group });
        }

        return merged;
    }, []);

    return mergedGroups.map(group => ({
        ...group,
        dateRange: group.startDate.isSame(group.endDate, 'month') ? group.startDate.format('YYYY-MM') : group.dateRange,
        centerDate: group.startDate.clone().add(group.endDate.diff(group.startDate) / 2)
    }));
}

/**
 * Serialize groups for JSON output (convert Moment objects to ISO strings).
 */
function serializeGroups(groups) {
    return groups.map(group => ({
        ...group,
        startDate: group.startDate.format(),
        endDate: group.endDate.format(),
        centerDate: group.centerDate.format(),
        images: group.images.map(img => ({
            ...img,
            date: img.date.format()
        }))
    }));
}

module.exports = { scanImages, serializeGroups };
