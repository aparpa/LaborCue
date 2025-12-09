#pragma once

#include <vector>
#include "RRInterval.h"

namespace hrv
{

    // Utility for computing HRV metrics from R-R interval streams.
    class HRVCalculator
    {
    public:
        // Compute RMSSD (root-mean-square of successive differences) in milliseconds.
        // Returns NaN if there are fewer than 2 samples.
        static double computeRMSSD(const std::vector<RRIntervalSample> &samples);
    };

} // namespace hrv
