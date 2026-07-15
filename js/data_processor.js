import Papa from 'papaparse';

export class DataProcessor {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.yearlyData = {};
        this.aggregatedBicycleAccidents = [];
        this.startYear = 2005;
        this.endYear = 2023;
        this.basePath = true ? '' : '/visionaries';

    }

    async loadAllYearsData() {
        this.logger.log('Starting to load data for all years');

        try {
            for (let year = this.startYear; year <= this.endYear; year++) {
                this.logger.log(`Loading data for year ${year}`);
                await this.loadYearData(year);
            }

            return this.processAllYearsBicycleAccidents();
        } catch (error) {
            this.logger.error('Error loading multi-year data:', error);
            throw error;
        }
    }

    async loadYearData(year) {
        try {
            const csvFiles = await Promise.all([
                this.loadCSVFile(year, 'clean-caracteristiques'),
                this.loadCSVFile(year, 'clean-vehicules'),
                this.loadCSVFile(year, 'clean-usagers'),
                this.loadCSVFile(year, 'clean-lieux')
            ]);

            this.yearlyData[year] = {
                caracteristiques: csvFiles[0],
                vehicules: csvFiles[1],
                usagers: csvFiles[2],
                lieux: csvFiles[3]
            };
        } catch (error) {
            this.logger.error(`Error loading data for year ${year}:`, error);
            this.yearlyData[year] = null;
        }
    }

    async loadCSVFile(year, filePrefix) {
        const filename = `${filePrefix}-${year}.csv`;
        try {
            const response = await fetch(`${this.basePath}/data/${year}/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            this.logger.error(`Error loading ${filename}:`, error);
            throw error;
        }
    }

    parseCSV(csvText) {
        const results = Papa.parse(csvText, {
            header: true,
            delimiter: ';',
            dynamicTyping: false,
            skipEmptyLines: true,
            transformHeader: header => header.trim()
        });

        if (results.errors.length > 0) {
            this.logger.warn('CSV parsing errors:', results.errors);
        }

        return results.data;
    }

    normalizeId(id) {
        if (!id) return '';
        return id.toString().trim();
    }

    processAllYearsBicycleAccidents() {
        this.aggregatedBicycleAccidents = [];

        Object.entries(this.yearlyData).forEach(([year, yearData]) => {
            if (!yearData) return; // Skip years with failed data loading
            const bicycleVehicles = yearData.vehicules.filter(v =>
                v.catv && ['1', '01'].includes(v.catv.toString().trim())
            );

            const bicycleAccidentIds = new Set(
                bicycleVehicles.map(v => this.normalizeId(v.Num_Acc))
            );

            const yearAccidents = yearData.caracteristiques
                .filter(acc => bicycleAccidentIds.has(this.normalizeId(acc.Num_Acc)))
                .map(acc => {
                    const normalizedId = this.normalizeId(acc.Num_Acc);
                    const lieuxInfo = yearData.lieux.find(l =>
                        this.normalizeId(l.Num_Acc) === normalizedId
                    );
                    const usagersInfo = yearData.usagers.filter(u =>
                        this.normalizeId(u.Num_Acc) === normalizedId
                    );

                    const lat = this.parseFrenchnumber(acc.lat);
                    const long = this.parseFrenchnumber(acc.long);

                    return {
                        ...acc,
                        year: parseInt(year),
                        lat,
                        long,
                        users: usagersInfo,
                        location_details: lieuxInfo
                    };
                });
            this.logger.log(yearAccidents)

            this.aggregatedBicycleAccidents.push(...yearAccidents);
        });

        return this.aggregatedBicycleAccidents;
    }

    parseFrenchnumber(str) {
        if (!str) return null;
        return parseFloat(str.toString().trim().replace(',', '.'));
    }

    // Enhanced analysis methods for multi-year data
    getAccidentsByYearAndMonth() {
        return this.aggregatedBicycleAccidents.reduce((acc, accident) => {
            const year = accident.year || 'unknown';
            const month = accident.mois || 'unknown';
            acc[year] = acc[year] || {};
            acc[year][month] = (acc[year][month] || 0) + 1;
            return acc;
        }, {});
    }

    getAccidentsByYearAndGravity() {
        return this.aggregatedBicycleAccidents.reduce((acc, accident) => {
            const year = accident.year || 'unknown';
            const gravity = accident.grav || 'unknown';
            acc[year] = acc[year] || {};
            acc[year][gravity] = (acc[year][gravity] || 0) + 1;
            return acc;
        }, {});
    }

    getGeographicClustersByYear(precision = 2) {
        return this.aggregatedBicycleAccidents.reduce((acc, accident) => {
            const year = accident.year || 'unknown';
            const latCluster = accident.lat;
            const longCluster = accident.long;
            const key = `${latCluster},${longCluster}`;

            acc[year] = acc[year] || {};
            acc[year][key] = (acc[year][key] || 0) + 1;
            return acc;
        }, {});
    }

    getUserDemographicsByYear() {
        return this.aggregatedBicycleAccidents.reduce((acc, accident) => {
            const year = accident.year || 'unknown';
            acc[year] = acc[year] || { userTypes: {}, ageGroups: {} };

            accident.users.forEach(user => {
                const userType = user.catu || 'unknown';
                const age = user.age;

                acc[year].userTypes[userType] = (acc[year].userTypes[userType] || 0) + 1;

                if (age !== null && age !== undefined) {
                    const ageGroup = this.categorizeAge(age);
                    acc[year].ageGroups[ageGroup] = (acc[year].ageGroups[ageGroup] || 0) + 1;
                }
            });

            return acc;
        }, {});
    }

    categorizeAge(age) {
        if (age < 18) return '0-17';
        if (age < 25) return '18-24';
        if (age < 35) return '25-34';
        if (age < 45) return '35-44';
        if (age < 55) return '45-54';
        if (age < 65) return '55-64';
        return '65+';
    }

    getYearlyTrends() {
        return {
            byYearAndMonth: this.getAccidentsByYearAndMonth(),
            byYearAndGravity: this.getAccidentsByYearAndGravity(),
            geographicClustersByYear: this.getGeographicClustersByYear(),
            userDemographicsByYear: this.getUserDemographicsByYear()
        };
    }

    // Additional analysis methods
    getTotalAccidentsByYear() {
        return this.aggregatedBicycleAccidents.reduce((acc, accident) => {
            const year = accident.year || 'unknown';
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});
    }

    getAverageGravityByYear() {
        const gravityCount = {};
        const gravitySum = {};

        this.aggregatedBicycleAccidents.forEach(accident => {
            const year = accident.year || 'unknown';
            const gravity = parseInt(accident.grav);

            if (!isNaN(gravity)) {
                gravityCount[year] = (gravityCount[year] || 0) + 1;
                gravitySum[year] = (gravitySum[year] || 0) + gravity;
            }
        });

        return Object.keys(gravityCount).reduce((acc, year) => {
            acc[year] = gravitySum[year] / gravityCount[year];
            return acc;
        }, {});
    }
}