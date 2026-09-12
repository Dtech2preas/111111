class SnapEngine {
    constructor(gridSize = 50) {
        this.gridSize = gridSize;
        this.snapTolerance = 25;
    }

    setGridSize(size) {
        this.gridSize = size;
    }

    snapToGrid(point) {
        return {
            x: Math.round(point.x / this.gridSize) * this.gridSize,
            y: Math.round(point.y / this.gridSize) * this.gridSize
        };
    }

    snapPoint(point, walls, useGrid = false, ignoreWallId = null, zoom = 1) {
        let closest = null;
        let minDistance = this.snapTolerance / zoom;

        // First pass: snap to endpoints (prioritize corners)
        for (const wall of walls) {
            if (ignoreWallId && wall.id === ignoreWallId) continue;

            const dStart = GeometryEngine.distance(point, wall.start);
            if (dStart < minDistance) {
                minDistance = dStart;
                closest = { x: wall.start.x, y: wall.start.y };
            }

            const dEnd = GeometryEngine.distance(point, wall.end);
            if (dEnd < minDistance) {
                minDistance = dEnd;
                closest = { x: wall.end.x, y: wall.end.y };
            }
        }

        // Second pass: if no endpoint is found, snap to line segment
        if (!closest) {
            minDistance = this.snapTolerance / zoom;
            for (const wall of walls) {
                if (ignoreWallId && wall.id === ignoreWallId) continue;

                const pLine = GeometryEngine.projectPointOnLine(point, wall.start, wall.end);
                const dLine = GeometryEngine.distance(point, pLine);
                if (dLine < minDistance) {
                    minDistance = dLine;
                    closest = pLine;
                }
            }
        }

        if (closest) return closest;

        if (useGrid) {
            return this.snapToGrid(point);
        }

        return point;
    }

    snapAngle(start, current, snapAngles = [0, 90, 180, 270, 45, 135, 225, 315]) {
        const dx = current.x - start.x;
        const dy = current.y - start.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const dist = GeometryEngine.distance(start, current);

        let closestAngle = angle;
        let minDiff = 15; // 15 degrees snap tolerance

        for (const a of snapAngles) {
            let normalizedA = a;
            let normalizedAngle = angle < 0 ? angle + 360 : angle;

            let diff = Math.abs(normalizedAngle - normalizedA);
            if (diff > 180) diff = 360 - diff;

            if (diff < minDiff) {
                minDiff = diff;
                closestAngle = normalizedA;
            }
        }

        if (closestAngle !== angle) {
            const rad = closestAngle * Math.PI / 180;
            return {
                x: start.x + Math.cos(rad) * dist,
                y: start.y + Math.sin(rad) * dist
            };
        }

        return current;
    }
}
