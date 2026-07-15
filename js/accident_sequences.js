import { DataProcessor } from "./data_processor.js";

// Constants for accident categorization
const ACCIDENT_MAPPINGS = {
    timeOfDay: {
        "1": "jour",
        "2": "crepuscule",
        "3": "nuit-sans-eclairage",
        "4": "nuit-eclairage-eteint",
        "5": "nuit-eclairage-allume"
    },
    weather: {
        "1": "normal",
        "2": "pluie-legere",
        "3": "pluie-forte",
        "4": "neige-grele",
        "5": "brouillard",
        "6": "vent-tempete",
        "7": "temps-eblouissant",
        "8": "temps-couvert"
    },
    roadType: {
        "1": "autoroute",
        "2": "nationale",
        "3": "departementale",
        "4": "communale",
        "5": "hors-reseau",
        "6": "parc-stationnement",
        "7": "urbaine",
        "9": "autre"
    },
    infra: {
        "1": "souterrain",
        "2": "pont",
        "3": "echangeur",
        "4": "voie-ferree",
        "5": "carrefour",
        "6": "zone-pietonne",
        "7": "peage",
        "8": "chantier"
    },
    surface: {
        "1": "normale",
        "2": "mouillee",
        "3": "flaques",
        "4": "inondee",
        "5": "enneigee",
        "6": "boue",
        "7": "verglacee",
        "8": "corps-gras",
        "9": "autre"
    },
    vosp: {
        "1": "piste-cyclable",
        "2": "bande-cyclable",
        "3": "voie-reservee"
    },
    collision: {
        "1": "deux-vehicules-frontale",
        "2": "deux-vehicules-arriere",
        "3": "deux-vehicules-cote",
        "4": "trois-plus-chaine",
        "5": "trois-plus-multiples",
        "6": "autre-collision",
        "7": "sans-collision"
    },
    gravity: {
        1: "indemne",
        2: "tue",
        3: "hospitalise",
        4: "blesse-leger"
    }
};

export class AccidentSequences {
    constructor() {
        this.processor = new DataProcessor();
    }

    async createHierarchicalData() {
        const data = await this.processor.loadAllYearsData();
        const sequences = data.map((accident) => this.createSequence(accident));
        return this.buildHierarchy(sequences);
    }

    createSequence(accident) {
        // Build full sequence with all details
        const sequence = [
            ACCIDENT_MAPPINGS.timeOfDay[accident.lum] || "inconnu",
            ACCIDENT_MAPPINGS.weather[accident.atm] || "autre",
            this.getSeverityString(accident),
            this.getRoadConditionString(accident),
            ACCIDENT_MAPPINGS.collision[accident.col] || "autre-collision",
            // this.getLocationString(accident),
        ];

        return {
            sequence: sequence.join('-'),
            value: 1
        };
    }

    getLocationString(accident) {
        const location = accident.agg === "1" ? "hors-agglomeration" : "en-agglomeration";
        const roadType = ACCIDENT_MAPPINGS.roadType[accident.location_details?.catr] || "autre";
        const infra = ACCIDENT_MAPPINGS.infra[accident.location_details?.infra] || "standard";
        return `${location}-${roadType}-${infra}`;
    }

    getRoadConditionString(accident) {
        const surface = ACCIDENT_MAPPINGS.surface[accident.location_details?.surf] || "inconnue";
        const vosp = ACCIDENT_MAPPINGS.vosp[accident.location_details?.vosp] || "standard";
        return `${surface}-${vosp}`;
    }

    getSeverityString(accident) {
        if (!accident.users?.length) return "inconnu";

        const worstGrav = Math.min(...accident.users.map(u => parseInt(u.grav)));
        const severity = ACCIDENT_MAPPINGS.gravity[worstGrav] || "inconnu";
        const userCount = accident.users.length;
        return `${severity}-${userCount > 1 ? "multiple" : "seul"}-${userCount} personnes`;
    }

    buildHierarchy(sequences) {
        const root = { name: "root", children: [] };

        sequences.forEach(({ sequence, value }) => {
            let currentNode = root;
            sequence.split('-').forEach(part => {
                let child = currentNode.children?.find(c => c.name === part);
                if (!child) {
                    child = { name: part, children: [] };
                    currentNode.children = currentNode.children || [];
                    currentNode.children.push(child);
                }
                currentNode = child;
            });
            currentNode.value = (currentNode.value || 0) + value;
        });

        return root;
    }
}