import { Product, Transaction } from '@/app/App';


export const calculateVelocity = (productId: string, transactions: Transaction[]) => {
    // Exponential Smoothing Algorithm (α = 0.7)
    // Formula: Ft+1 = α * Dt + (1 - α) * Ft
    const ALPHA = 0.7;

    // Track daily sales over the last 30 days
    const today = new Date();
    const dailySales = new Array(30).fill(0);

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        const diffTime = Math.abs(today.getTime() - tDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
            const item = t.items.find((i: any) => i.productId === productId);
            if (item) {
                // index 0 is 29 days ago, index 29 is today
                const index = 29 - diffDays;
                if (index >= 0 && index < 30) {
                    dailySales[index] += item.quantity;
                }
            }
        }
    });

    // Establish baseline (Ft) using simple average of the oldest 7 days
    let initialDemand = 0;
    for (let i = 0; i < 7; i++) {
        initialDemand += dailySales[i];
    }
    let currentForecast = initialDemand / 7;

    // Apply Exponential Smoothing equation iteratively up to present day
    for (let i = 7; i < 30; i++) {
        const actualDemand = dailySales[i]; // Dt
        currentForecast = (ALPHA * actualDemand) + ((1 - ALPHA) * currentForecast); // Ft+1
    }

    // Prevent negative forecasts
    return Math.max(0, currentForecast);
};


export const getForecast = (product: Product, transactions: Transaction[], upcomingRain: boolean) => {
    const total = (Number(product.quantity) + Number(product.newStockQuantity || 0));
    const velocity = calculateVelocity(product.id, transactions);
    const daysRemaining = velocity > 0
        ? Math.floor(total / velocity)
        : (total === 0 ? 0 : Infinity);

    // Determine if product is Fast-Moving or Slow-Moving based on velocity
    const isFastMoving = velocity > 2; // Selling more than 2 items per day on average

    // Fast-moving items restock for 14 days (2 weeks) to avoid overstocking and cash flow issues
    // Slow-moving items restock for 30 days (1 month)
    const restockDays = isFastMoving ? 14 : 30;

    // Calculate targeted need
    let targetNeed = Math.ceil(velocity * restockDays);

    const reorderRecommendation = Math.max(0, targetNeed - total);

    // Fallback: If stock is below reorder level but reorderRecommendation is 0 (low velocity)
    // recommend ordering at least up to reorder level + some buffer
    let finalRecommendation = reorderRecommendation;
    if (total < product.reorderLevel && finalRecommendation === 0) {
        finalRecommendation = Math.max(product.reorderLevel * 2 - total, 10);
    }

    // Calculate Buy Date (Stockout Date - 2 days for lead time)
    const buyDate = new Date();
    if (daysRemaining !== Infinity && daysRemaining > 0) {
        // Recommend buying 7 days BEFORE stockout (1 week lead time)
        buyDate.setDate(buyDate.getDate() + daysRemaining - 7);
    }

    return {
        velocity: velocity.toFixed(2),
        daysRemaining,
        reorderRecommendation: finalRecommendation,
        isHighDemand: velocity > 1,
        recommendedBuyDate: daysRemaining === Infinity ? 'N/A' : buyDate.toLocaleDateString(),
        stockOutDate: daysRemaining === Infinity ? 'N/A' : new Date(Date.now() + daysRemaining * 86400000).toLocaleDateString()
    };
};

export const calculateAccuracyMetrics = (productId: string, transactions: Transaction[], testDays: number = 30) => {
    // 1. Prepare Daily Sales
    // We need 30 days of data BEFORE the test window to build the initial SMA/ES.
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0); // Normalize to midnight

    const DAYS = testDays + 30;
    const dailySales = new Array(DAYS).fill(0);

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0); // Normalize to midnight
        const diffTime = baseDate.getTime() - tDate.getTime();
        // Only count if diffTime is positive (i.e. transaction is before or on baseDate)
        if (diffTime >= 0) {
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Use round to handle DST edge cases

            if (diffDays < DAYS) {
                const item = t.items.find((i: any) => i.productId === productId);
                if (item) {
                    const index = (DAYS - 1) - diffDays;
                    if (index >= 0 && index < DAYS) {
                        dailySales[index] += item.quantity;
                    }
                }
            }
        }
    });

    // We will test over the last `testDays` days (indices 30 to DAYS - 1).
    let smaErrors = { mapeSum: 0, maeSum: 0, rmseSum: 0, count: 0 };
    let esErrors = { mapeSum: 0, maeSum: 0, rmseSum: 0, count: 0 };

    const ALPHA = 0.7;
    const chartData = [];

    for (let t = 30; t < DAYS; t++) {
        const actual = dailySales[t];

        // Calculate SMA (average of previous 30 days)
        let smaSum = 0;
        for (let j = 1; j <= 30; j++) {
            smaSum += dailySales[t - j];
        }
        const smaForecast = smaSum / 30;

        // Calculate Exponential Smoothing up to t-1
        // Baseline is average of first 7 days of the training window
        let esInitial = 0;
        for (let j = t - 30; j < t - 30 + 7; j++) {
            esInitial += dailySales[j];
        }
        let esForecast = esInitial / 7;

        for (let j = t - 30 + 7; j < t; j++) {
            esForecast = (ALPHA * dailySales[j]) + ((1 - ALPHA) * esForecast);
        }

        // Calculate Errors only if actual > 0 (avoids Infinity in MAPE)
        if (actual > 0) {
            const smaDiff = Math.abs(actual - smaForecast);
            smaErrors.mapeSum += (smaDiff / actual);
            smaErrors.maeSum += smaDiff;
            smaErrors.rmseSum += Math.pow(smaDiff, 2);
            smaErrors.count++;

            const esDiff = Math.abs(actual - esForecast);
            esErrors.mapeSum += (esDiff / actual);
            esErrors.maeSum += esDiff;
            esErrors.rmseSum += Math.pow(esDiff, 2);
            esErrors.count++;
        }

        // Add to chart data ALWAYS (even if actual is 0) so lines can connect
        const dateObj = new Date(baseDate);
        dateObj.setDate(baseDate.getDate() - ((DAYS - 1) - t));
        chartData.push({
            date: dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            Actual: actual,
            SMA: parseFloat(smaForecast.toFixed(1)),
            'Exp. Smoothing': parseFloat(esForecast.toFixed(1))
        });
    }

    if (smaErrors.count === 0) {
        return null; // Not enough data to compare
    }

    return {
        sma: {
            mape: ((smaErrors.mapeSum / smaErrors.count) * 100).toFixed(2) + '%',
            mae: (smaErrors.maeSum / smaErrors.count).toFixed(2),
            rmse: Math.sqrt(smaErrors.rmseSum / smaErrors.count).toFixed(2)
        },
        exponentialSmoothing: {
            mape: ((esErrors.mapeSum / esErrors.count) * 100).toFixed(2) + '%',
            mae: (esErrors.maeSum / esErrors.count).toFixed(2),
            rmse: Math.sqrt(esErrors.rmseSum / esErrors.count).toFixed(2)
        },
        chartData
    };
};

export const calculateDailyAccuracyMetrics = (productId: string, transactions: Transaction[], daysToTest: number = 7) => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0); 
    
    const PRE_DAYS = 3; // 3 days for SMA baseline
    const TOTAL_DAYS = daysToTest + PRE_DAYS;
    const dailySales = new Array(TOTAL_DAYS).fill(0);

    transactions.forEach(t => {
        const tDate = new Date(t.date);
        tDate.setHours(0, 0, 0, 0); 
        const diffTime = baseDate.getTime() - tDate.getTime();
        
        if (diffTime >= 0) {
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays < TOTAL_DAYS) {
                const item = t.items.find((i: any) => i.productId === productId);
                if (item) {
                    const index = (TOTAL_DAYS - 1) - diffDays;
                    if (index >= 0 && index < TOTAL_DAYS) {
                        dailySales[index] += item.quantity;
                    }
                }
            }
        }
    });

    let sumDemand = 0;
    let countDays = 0;
    for (let i = Math.max(0, TOTAL_DAYS - 30); i < TOTAL_DAYS; i++) {
        sumDemand += dailySales[i];
        countDays++;
    }
    const avgDailyDemand = countDays > 0 ? (sumDemand / countDays) : 0;

    let demandClassification = 'Low Demand';
    if (avgDailyDemand > 2) {
        demandClassification = 'High Demand';
    } else if (avgDailyDemand >= 0.5) {
        demandClassification = 'Medium Demand';
    }

    let smaErrors = { mapeSum: 0, maeSum: 0, rmseSum: 0, count: 0 };
    
    // First, calculate SMA errors to compare against
    for (let d = PRE_DAYS; d < TOTAL_DAYS; d++) {
        const actual = dailySales[d];
        let smaSum = 0;
        for (let j = 1; j <= 3; j++) {
            smaSum += dailySales[d - j];
        }
        const smaForecast = smaSum / 3;

        if (actual > 0) {
            const smaDiff = Math.abs(actual - smaForecast);
            smaErrors.mapeSum += (smaDiff / actual);
            smaErrors.maeSum += smaDiff;
            smaErrors.rmseSum += Math.pow(smaDiff, 2);
            smaErrors.count++;
        }
    }

    // Calculate Exponential Smoothing errors (Fixed Alpha = 0.7)
    let esErrors = { mapeSum: 0, maeSum: 0, rmseSum: 0, count: 0 };
    let chartData = [];
    const testAlpha = 0.7;

    for (let d = PRE_DAYS; d < TOTAL_DAYS; d++) {
        const actual = dailySales[d];
        
        // Re-calculate SMA for chart data alignment
        let smaSum = 0;
        for (let j = 1; j <= 3; j++) {
            smaSum += dailySales[d - j];
        }
        const smaForecast = smaSum / 3;

        let esInitial = 0;
        for (let j = 0; j < PRE_DAYS; j++) {
            esInitial += dailySales[j];
        }
        let esForecast = esInitial / PRE_DAYS;

        for (let j = PRE_DAYS; j < d; j++) {
            esForecast = (testAlpha * dailySales[j]) + ((1 - testAlpha) * esForecast);
        }

        if (actual > 0) {
            const esDiff = Math.abs(actual - esForecast);
            esErrors.mapeSum += (esDiff / actual);
            esErrors.maeSum += esDiff;
            esErrors.rmseSum += Math.pow(esDiff, 2);
            esErrors.count++;
        }

        const offsetDays = (TOTAL_DAYS - 1) - d;
        const dateObj = new Date(baseDate);
        dateObj.setDate(baseDate.getDate() - offsetDays);
        
        const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        chartData.push({
            date: dateLabel,
            Actual: actual,
            SMA: parseFloat(smaForecast.toFixed(1)),
            'Exp. Smoothing': parseFloat(esForecast.toFixed(1))
        });
    }

    if (smaErrors.count === 0 || esErrors.count === 0) {
        return {
            classification: demandClassification,
            avgDailyDemand: avgDailyDemand.toFixed(1),
            sma: null,
            exponentialSmoothing: null,
            chartData: chartData
        };
    }

    const smaMape = (smaErrors.mapeSum / smaErrors.count) * 100;
    const esMape = (esErrors.mapeSum / esErrors.count) * 100;

    let smaMae = (smaErrors.maeSum / smaErrors.count);
    let smaRmse = Math.sqrt(smaErrors.rmseSum / smaErrors.count);
    
    let esMae = (esErrors.maeSum / esErrors.count);
    let esRmse = Math.sqrt(esErrors.rmseSum / esErrors.count);

    return {
        classification: demandClassification,
        avgDailyDemand: avgDailyDemand.toFixed(1),
        sma: {
            mape: smaMape.toFixed(2) + '%',
            mae: smaMae.toFixed(2),
            rmse: smaRmse.toFixed(2),
            mapeRaw: smaMape
        },
        exponentialSmoothing: {
            mape: esMape.toFixed(2) + '%',
            mae: esMae.toFixed(2),
            rmse: esRmse.toFixed(2),
            mapeRaw: esMape
        },
        chartData: chartData
    };
};
