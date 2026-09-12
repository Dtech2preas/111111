class RoomDetection {
    static detect(walls) {
        if (!walls || walls.length === 0) return [];
        return GeometryEngine.detectRooms(walls);
    }
}
