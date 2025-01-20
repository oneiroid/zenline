const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Copy the scanImages function from app.js
function scanImages() {
    const imgDir = path.join(__dirname, 'public', 'imgs');
    const MIN_GROUP_SIZE = 7;
    const MAX_MONTHS_DISTANCE = 3;

    // First scan for images and their associated GLB files
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

    const groups = Object.entries(images.reduce((groups, img) => {
        groups[img.month] = (groups[img.month] || []).concat(img);
        return groups;
    }, {}))
        .map(([month, images]) => ({
            dateRange: month,
            startDate: moment(month, 'YYYY-MM'),
            endDate: moment(month, 'YYYY-MM').endOf('month'),
            centerDate: moment(month, 'YYYY-MM').add(15, 'days'),
            images,
            size: images.length
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

// Generate the static JSON file
try {
    const groups = scanImages();
    // Convert Moment objects to strings for JSON serialization
    const serializedGroups = groups.map(group => ({
        ...group,
        startDate: group.startDate.format(),
        endDate: group.endDate.format(),
        centerDate: group.centerDate.format(),
        images: group.images.map(img => ({
            ...img,
            date: img.date.format()
        }))
    }));
    
    fs.writeFileSync(
        path.join(__dirname, 'public', 'data', 'images.json'),
        JSON.stringify(serializedGroups, null, 2)
    );
    console.log('Successfully generated static JSON file');
} catch (error) {
    console.error('Error generating static JSON:', error);
    process.exit(1);
} 