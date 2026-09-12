class CanvasRenderer {
    constructor(ctx, canvas, model) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.model = model;
    }

    render(state) {
        const { panX, panY, zoom, currentTool, tempWallStart, currentMousePos, selectedElementId, measurement, snapPoint } = state;
        const data = this.model.data;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(panX, panY);
        this.ctx.scale(zoom, zoom);

        this.drawGrid(panX, panY, zoom);

        // Rooms
        for (const room of data.rooms) {
            this.drawRoom(room, room.id === selectedElementId, zoom);
        }

        // Walls
        for (const wall of data.walls) {
            this.drawWall(wall, wall.id === selectedElementId, zoom);
        }

        // Temp Wall
        if (currentTool === 'wall' && tempWallStart && currentMousePos) {
            this.drawTempWall(tempWallStart, currentMousePos, data.scale, zoom);
        }

        // Doors & Windows
        for (const door of data.doors) {
            this.drawDoor(door, door.id === selectedElementId, zoom);
        }
        for (const win of data.windows) {
            this.drawWindow(win, win.id === selectedElementId, zoom);
        }

        // Objects (Furniture)
        if (data.objects) {
            for (const obj of data.objects) {
                this.drawObject(obj, obj.id === selectedElementId, zoom);
            }
        }

        // Labels
        if (data.labels) {
            for (const lbl of data.labels) {
                this.drawLabel(lbl, lbl.id === selectedElementId, zoom);
            }
        }

        // Snap Point Indicator
        if (snapPoint && (currentTool === 'wall' || currentTool === 'measurement')) {
            this.drawSnapIndicator(snapPoint, zoom);
        }

        // Measurement
        if (measurement && measurement.active && measurement.startPoint && measurement.endPoint) {
            this.drawMeasurement(measurement, data.scale, zoom);
        }

        this.ctx.restore();
    }

    drawGrid(panX, panY, zoom) {
        const gridSize = 50;
        const w = this.canvas.width / zoom;
        const h = this.canvas.height / zoom;

        const startX = -panX / zoom;
        const startY = -panY / zoom;

        this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        this.ctx.lineWidth = 1 / zoom;

        this.ctx.beginPath();
        for (let x = Math.floor(startX / gridSize) * gridSize; x < startX + w; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, startY + h);
        }
        for (let y = Math.floor(startY / gridSize) * gridSize; y < startY + h; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(startX + w, y);
        }
        this.ctx.stroke();
    }

    drawWall(wall, isSelected, zoom) {
        this.ctx.beginPath();
        this.ctx.moveTo(wall.start.x, wall.start.y);
        this.ctx.lineTo(wall.end.x, wall.end.y);
        this.ctx.strokeStyle = isSelected ? '#3498db' : '#2c3e50';
        this.ctx.lineWidth = wall.thickness;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        if (isSelected) {
            // Draw endpoints
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#3498db';
            this.ctx.lineWidth = 2 / zoom;

            this.ctx.beginPath();
            this.ctx.arc(wall.start.x, wall.start.y, 6/zoom, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(wall.end.x, wall.end.y, 6/zoom, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.stroke();

            const dist = GeometryEngine.distance(wall.start, wall.end);
            const mDist = (dist * this.model.data.scale).toFixed(2);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = `${14/zoom}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${mDist}m`, (wall.start.x + wall.end.x)/2, (wall.start.y + wall.end.y)/2 - wall.thickness - 5/zoom);
        }
    }

    drawTempWall(start, end, scale, zoom) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
        this.ctx.lineWidth = 10;
        this.ctx.stroke();

        const dist = GeometryEngine.distance(start, end);
        const mDist = (dist * scale).toFixed(2);
        this.ctx.fillStyle = '#2980b9';
        this.ctx.font = `${14/zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${mDist}m`, (start.x + end.x)/2, (start.y + end.y)/2 - 15/zoom);
    }

    drawRoom(room, isSelected, zoom) {
        if (!room.boundary || room.boundary.length < 3) return;

        this.ctx.beginPath();
        this.ctx.moveTo(room.boundary[0].x, room.boundary[0].y);
        for(let i=1; i<room.boundary.length; i++) {
            this.ctx.lineTo(room.boundary[i].x, room.boundary[i].y);
        }
        this.ctx.closePath();

        this.ctx.fillStyle = isSelected ? 'rgba(52, 152, 219, 0.3)' : 'rgba(236, 240, 241, 0.6)';
        this.ctx.fill();

        if (isSelected) {
            this.ctx.strokeStyle = '#3498db';
            this.ctx.lineWidth = 2 / zoom;
            this.ctx.stroke();
        }

        let cx = 0, cy = 0;
        for(let p of room.boundary) { cx += p.x; cy += p.y; }
        cx /= room.boundary.length;
        cy /= room.boundary.length;

        this.ctx.fillStyle = '#34495e';
        this.ctx.font = `bold ${14/zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(room.name, cx, cy);
        this.ctx.font = `${12/zoom}px Arial`;
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillText(`${room.area.toFixed(2)} m²`, cx, cy + 16/zoom);
    }

    drawDoor(door, isSelected, zoom) {
        this.ctx.save();
        this.ctx.translate(door.position.x, door.position.y);
        this.ctx.rotate(door.rotation || 0);

        this.ctx.strokeStyle = isSelected ? '#3498db' : '#e67e22';
        this.ctx.fillStyle = '#fff';
        this.ctx.lineWidth = 2 / zoom;

        // Draw basic door representation (arc + line)
        const w = door.width;
        this.ctx.beginPath();
        this.ctx.moveTo(-w/2, 0);
        this.ctx.lineTo(w/2, 0);
        this.ctx.stroke();

        this.ctx.beginPath();
        if (door.flip) {
            this.ctx.arc(w/2, 0, w, Math.PI, Math.PI + Math.PI/2);
            this.ctx.moveTo(w/2, 0);
            this.ctx.lineTo(w/2, -w);
        } else {
            this.ctx.arc(-w/2, 0, w, -Math.PI/2, 0);
            this.ctx.moveTo(-w/2, 0);
            this.ctx.lineTo(-w/2, -w);
        }
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawWindow(win, isSelected, zoom) {
        this.ctx.save();
        this.ctx.translate(win.position.x, win.position.y);
        this.ctx.rotate(win.rotation || 0);

        this.ctx.strokeStyle = isSelected ? '#3498db' : '#3498db';
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.lineWidth = 2 / zoom;

        this.ctx.fillRect(-win.width/2, -5, win.width, 10);
        this.ctx.strokeRect(-win.width/2, -5, win.width, 10);

        // Inner lines
        this.ctx.beginPath();
        this.ctx.moveTo(-win.width/2, 0);
        this.ctx.lineTo(win.width/2, 0);
        this.ctx.stroke();

        this.ctx.restore();
    }

    drawObject(obj, isSelected, zoom) {
        this.ctx.save();
        this.ctx.translate(obj.position.x, obj.position.y);
        this.ctx.rotate(obj.rotation || 0);

        this.ctx.fillStyle = isSelected ? 'rgba(52, 152, 219, 0.2)' : 'rgba(149, 165, 166, 0.2)';
        this.ctx.strokeStyle = isSelected ? '#2980b9' : '#7f8c8d';
        this.ctx.lineWidth = 2 / zoom;

        this.ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
        this.ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        this.ctx.fillStyle = '#34495e';
        this.ctx.font = `${10/zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.type, 0, 0);

        this.ctx.restore();
    }

    drawLabel(lbl, isSelected, zoom) {
        this.ctx.fillStyle = isSelected ? '#2980b9' : (lbl.color || '#333');
        this.ctx.font = `${(lbl.fontSize || 14)/zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(lbl.text, lbl.position.x, lbl.position.y);
    }

    drawSnapIndicator(pos, zoom) {
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 5/zoom, 0, Math.PI*2);
        this.ctx.fillStyle = 'rgba(46, 204, 113, 0.8)';
        this.ctx.fill();
    }

    drawMeasurement(meas, scale, zoom) {
        this.ctx.beginPath();
        this.ctx.moveTo(meas.startPoint.x, meas.startPoint.y);
        this.ctx.lineTo(meas.endPoint.x, meas.endPoint.y);
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.setLineDash([5/zoom, 5/zoom]);
        this.ctx.lineWidth = 2/zoom;
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        const dist = GeometryEngine.distance(meas.startPoint, meas.endPoint) * scale;
        this.ctx.fillStyle = '#c0392b';
        this.ctx.font = `bold ${14/zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${dist.toFixed(2)}m`, (meas.startPoint.x + meas.endPoint.x)/2, (meas.startPoint.y + meas.endPoint.y)/2 - 10/zoom);
    }
}
