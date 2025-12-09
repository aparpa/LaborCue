#include "hrv/HRVCalculator.h"

#include <cmath>
#include <limits>

namespace hrv
{

    double HRVCalculator::computeRMSSD(const std::vector<RRIntervalSample> &samples)
    {
        if (samples.size() < 2)
        {
            return std::numeric_limits<double>::quiet_NaN();
        }

        double sum_sq = 0.0;
        std::size_t count = 0;

        for (std::size_t i = 1; i < samples.size(); ++i)
        {
            double diff = samples[i].rr_ms - samples[i - 1].rr_ms;
            sum_sq += diff * diff;
            ++count;
        }

        if (count == 0)
        {
            return std::numeric_limits<double>::quiet_NaN();
        }

        double mean_sq = sum_sq / static_cast<double>(count);
        return std::sqrt(mean_sq);
    }

} // namespace hrv
