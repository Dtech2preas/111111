class ObjectManager {
    static FURNITURE_TYPES = {
        'bed': { name: 'Bed', width: 140, height: 200, category: 'bedroom' },
        'wardrobe': { name: 'Wardrobe', width: 120, height: 60, category: 'bedroom' },
        'desk': { name: 'Desk', width: 120, height: 60, category: 'bedroom' },
        'sofa': { name: 'Sofa', width: 200, height: 80, category: 'living' },
        'tv': { name: 'TV', width: 120, height: 20, category: 'living' },
        'coffee_table': { name: 'Coffee Table', width: 100, height: 60, category: 'living' },
        'stove': { name: 'Stove', width: 60, height: 60, category: 'kitchen' },
        'fridge': { name: 'Fridge', width: 60, height: 60, category: 'kitchen' },
        'sink': { name: 'Sink', width: 60, height: 50, category: 'kitchen' },
        'counter': { name: 'Counter', width: 120, height: 60, category: 'kitchen' },
        'toilet': { name: 'Toilet', width: 40, height: 60, category: 'bathroom' },
        'shower': { name: 'Shower', width: 90, height: 90, category: 'bathroom' },
        'bath': { name: 'Bath', width: 170, height: 70, category: 'bathroom' },
        'basin': { name: 'Basin', width: 60, height: 40, category: 'bathroom' }
    };

    static getDefaultSize(type) {
        const info = this.FURNITURE_TYPES[type];
        if (info) {
            return { width: info.width, height: info.height }; // These should be in cm, model uses m for scale but drawing uses canvas units.
        }
        return { width: 50, height: 50 };
    }

    static getCategories() {
        const cats = {};
        for (const [key, value] of Object.entries(this.FURNITURE_TYPES)) {
            if (!cats[value.category]) cats[value.category] = [];
            cats[value.category].push({ id: key, ...value });
        }
        return cats;
    }
}
