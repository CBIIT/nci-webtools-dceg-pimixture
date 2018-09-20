appMixture.TemplatesModel = Backbone.Model.extend({
    url: 'templateList'
});

appMixture.BaseModel = Backbone.Model.extend({
    defaults: {
        'form': {},
        'results': {}
    }
});

appMixture.FormModel = Backbone.Model.extend({
    defaults: {
        'isMutuallyExclusive': true,
        'csvFile': {},
        'design': "",
        'headers': [],
        'uniqueValues': {},
        'model': "",
        'outcomeC': "",
        'outcomeL': "",
        'outcomeR': "",
        'covariatesSelection': "",
        'covariatesArr': [],
        'covariatesArrValid': true,
        'effects': [],
        'references': [],
        'email': ""
    }
});

appMixture.EffectsModel = Backbone.Model.extend({
    defaults: {
        'formModel': {},
        'covariates': [],
        'first': "",
        'second': "",
        'effects': []
    }
});

appMixture.ReferencesModel = Backbone.Model.extend({
    defaults: {
        'valid': false,
        'covariates': [],
        'uniqueValues': {},
        'formModel': {},
        'references': {}
    }
});

appMixture.ResultsModel = Backbone.Model.extend({
    url: "run"
});

appMixture.PredictionModel = Backbone.Model.extend({
    defaults: {
        'rdsFile': {},
        'testDataFile': {},
        'timePointType': 'Range'
    }
});

appMixture.PredictionResultModel = Backbone.Model.extend({
    defaults: {
        pageSizeChoices: [ 15, 25, 50, 100, 150, 200, 250],
        pageNum: 1,
        pages: 0,
        start: 0,
        end: 25,
        pageSize: 25
    },
    parse: function(res) {
        res.pageNum = 1;
        if (res.results && res.results.prediction) {
            res.pages = Math.ceil(res.results.prediction.length / this.defaults.pageSize);
        }
        res.start = 0;
        res.end = this.defaults.pageSize < res.results.prediction.length ? this.defaults.pageSize : res.results.prediction.length;
        res.pageSize = this.defaults.pageSize;
        res.pageSizeChoices = this.defaults.pageSizeChoices;
        return res;
    },
    url: "predict"
});
