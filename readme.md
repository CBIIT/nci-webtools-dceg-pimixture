# PIMixture Web Tool

## Getting Started

#### Install R Dependencies
```R
install.packages('remotes', repos='https://cloud.r-project.org')
remotes::install_bioc('Icens')
remotes::install_github('CBIIT/R-PIMixture')
```

#### Install Python 3.6 dependencies
```bash
pip install -r requirements.txt
```

#### Configure Application
```bash
# update config.ini with actual configuration
cp config.sample.ini config.ini
```

#### Start Application
```bash
# for local development (http://localhost)
python pimixture.py --debug
```
