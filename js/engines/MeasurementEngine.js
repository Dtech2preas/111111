class MeasurementEngine {
    constructor() {
        this.active = false;
        this.startPoint = null;
        this.endPoint = null;
    }

    startMeasurement(point) {
        this.active = true;
        this.startPoint = point;
        this.endPoint = point;
    }

    updateMeasurement(point) {
        if (this.active) {
            this.endPoint = point;
        }
    }

    endMeasurement() {
        this.active = false;
        const res = { start: this.startPoint, end: this.endPoint };
        this.startPoint = null;
        this.endPoint = null;
        return res;
    }

    getDistance(scale) {
        if (!this.startPoint || !this.endPoint) return 0;
        return GeometryEngine.distance(this.startPoint, this.endPoint) * scale;
    }

    getDetails(scale) {
        if (!this.startPoint || !this.endPoint) return null;
        const dist = GeometryEngine.distance(this.startPoint, this.endPoint) * scale;
        const dx = Math.abs(this.endPoint.x - this.startPoint.x) * scale;
        const dy = Math.abs(this.endPoint.y - this.startPoint.y) * scale;
        return { distance: dist, dx, dy };
    }
}
