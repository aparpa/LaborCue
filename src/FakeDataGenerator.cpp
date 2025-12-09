#include "hrv/FakeDataGenerator.h"

#include <random>

namespace hrv
{

    using Clock = std::chrono::system_clock;
    using Days = std::chrono::duration<int, std::ratio<60 * 60 * 24>>;

    std::vector<NightlyHRV> FakeDataGenerator::generateSyntheticNightlySeries(
        Clock::time_point start_date,
        int nights)
    {
        std::vector<NightlyHRV> series;
        if (nights <= 0)
        {
            return series;
        }

        series.reserve(static_cast<std::size_t>(nights));

        std::mt19937 rng(42);
        std::normal_distribution<double> noise(0.0, 2.0); // small random jitter

        int midpoint = nights / 2;

        for (int i = 0; i < nights; ++i)
        {
            double base_hrv;
            if (i <= midpoint)
            {
                // Gradual decline.
                base_hrv = 55.0 - 0.5 * static_cast<double>(i);
            }
            else
            {
                // Gradual rise after inversion.
                base_hrv = 40.0 + 0.7 * static_cast<double>(i - midpoint);
            }

            NightlyHRV nightly{};
            nightly.date = start_date + Days{i};
            nightly.rmssd_ms = base_hrv + noise(rng);
            series.push_back(nightly);
        }

        return series;
    }

} // namespace hrv
