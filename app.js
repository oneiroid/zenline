const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

// Function to scan images and group them by date
function scanImages() {
    const imgDir = path.join(__dirname, 'public', 'imgs');
    const MIN_GROUP_SIZE = 7;
    const MAX_MONTHS_DISTANCE = 3;

    const images = fs.readdirSync(imgDir)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
        .map(file => {
            const [datePart] = file.split('.');
            const date = moment(datePart.slice(0, 7)); // Directly parse YYYY-MM
            return {
                filename: file,
                date,
                month: date.format('YYYY-MM')
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
            centerDate: moment(month, 'YYYY-MM').add(15, 'days'), // Initial center date
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
            lastGroup.centerDate = lastGroup.startDate.clone().add(lastGroup.endDate.diff(lastGroup.startDate) / 2); // Recalculate center date
            lastGroup.dateRange = `${lastGroup.startDate.format('YYYY-MM')} to ${lastGroup.endDate.format('YYYY-MM')}`;
        } else {
            merged.push({ ...group });
        }

        return merged;
    }, []);


    return mergedGroups.map(group => ({
        ...group,
        dateRange: group.startDate.isSame(group.endDate, 'month') ? group.startDate.format('YYYY-MM') : group.dateRange,
        // Finalize centerDate and dateRange. This avoids redundant calculations during merging.
        centerDate: group.startDate.clone().add(group.endDate.diff(group.startDate) / 2)
    }));
}


// API endpoint to get image groups
app.get('/api/images', (req, res) => {
    try {
        const groups = scanImages();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Gallery app listening at http://localhost:${port}`);
}); 