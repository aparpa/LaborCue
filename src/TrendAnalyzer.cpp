#include "hrv/TrendAnalyzer.h"

namespace hrv
{

    InversionEvent TrendAnalyzer::detectInversion(const std::vector<NightlyHRV> &history)
    {
        InversionEvent ev;

        // Need enough points to say anything about trend.
        if (history.size() < 5)
        {
            return ev;
        }

        const std::size_t n = history.size();

        // TODO: Replace this simple sign-change heuristic with a more robust
        // statistical trend model (e.g., smoothed slopes, spline fit inspired by
        // Jasinski et al. 2024).
        // Current heuristic: if the last step was upward and the one before that
        // was downward, treat that as an inversion.

        double hrv_n3 = history[n - 3].rmssd_ms;
        double hrv_n2 = history[n - 2].rmssd_ms;
        double hrv_n1 = history[n - 1].rmssd_ms;

        double slope1 = hrv_n2 - hrv_n3; // earlier
        double slope2 = hrv_n1 - hrv_n2; // most recent

        if (slope1 < 0.0 && slope2 > 0.0)
        {
            ev.detected = true;
            ev.index = n - 1; // flag the most recent night as the inversion point
        }

        return ev;
    }

} // namespace hrv
