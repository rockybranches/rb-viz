import matplotlib

matplotlib.use("Agg")

import numpy as np
import pandas as pd
import pytest


@pytest.fixture(autouse=True)
def close_figures():
    yield
    import matplotlib.pyplot as plt

    plt.close("all")


@pytest.fixture
def intervals():
    """A 100 ft hole in 5 ft samples with a 10 ft gap and one sample that was not assayed."""
    rng = np.random.default_rng(0)
    tops = np.array([t for t in range(0, 100, 5) if t not in (40, 45)], dtype=float)
    df = pd.DataFrame({"from": tops, "to": tops + 5, "Au": rng.lognormal(-3, 1, len(tops)),
                       "Ag": rng.lognormal(0, 1, len(tops)),
                       "lith": np.where(tops < 30, "Shale", "Chert")})
    df.loc[3, "Au"] = np.nan
    return df
