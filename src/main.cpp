#include <chrono>
#include <iostream>
#include <optional>
#include <vector>

#include "hrv/AlertEngine.h"
#include "hrv/FakeDataGenerator.h"
#include "hrv/TrendAnalyzer.h"

// Simple CLI driver to exercise the nightly HRV trend and alerting logic
// using synthetic data. This is primarily for development / testing and
// demonstrates how the pieces of the C++ backend fit together.

int main()
{
    using Clock = std::chrono::system_clock;

    Clock::time_point start_date = Clock::now();

    // Generate 70 nights (~10 weeks) of synthetic HRV data.
    std::vector<hrv::NightlyHRV> history =
        hrv::FakeDataGenerator::generateSyntheticNightlySeries(start_date, 70);

    hrv::AlertEngine alert_engine;

    // For simplicity, treat each nightly HRV date as "today" for alerting.
    for (std::size_t i = 0; i < history.size(); ++i)
    {
        // Slice history up to current day.
        std::vector<hrv::NightlyHRV> upto(history.begin(), history.begin() + static_cast<long>(i + 1));

        // Only interpret the trend every two days, per requirements.
        if (i % 2 != 0)
        {
            continue;
        }

        hrv::InversionEvent inv = hrv::TrendAnalyzer::detectInversion(upto);
        std::optional<hrv::Alert> alert =
            alert_engine.updateAndMaybeGetAlert(upto, inv, history[i].date);

        if (alert.has_value() && alert->type != hrv::AlertType::None)
        {
            std::time_t t = Clock::to_time_t(alert->scheduled_for);
            std::cout << "[ALERT on " << std::ctime(&t) << "]: "
                      << alert->message << "\n"
                      << std::endl;
        }
    }

    // TODO: Wire this backend into a real data ingestion pipeline that
    //  - receives R-R intervals + timestamps from a wearable
    //  - feeds them into NightSession objects
    //  - persists nightly HRV summaries to disk or a database
    //  - exposes an API (CLI / gRPC / REST) for a mobile or web front-end.

    return 0;
}
