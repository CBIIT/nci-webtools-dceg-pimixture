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
        'csvFile': null,
        'design': "",
        'headers': [],
        'uniqueValues': {},
        'model': "",
        'outcomeC': "",
        'outcomeL': "",
        'outcomeR': "",
        'covariatesSelection': "",
        'covariatesArr': [],
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
    url: 'uploadModel',
    parse: function(res) {
        if (res.covariatesArr) {
            res.covariatesArr = res.covariatesArr.map(function(cov) {
                return {
                    name: cov, // name filed should be valid for HTML id (without spaces and special characters
                    value: null
                };
            });
        }
        return res;
    },
    defaults: {
        'covariatesArr': [],
        'testDataType': 'Upload',
        'timePointType': 'Range',
        'testData': [],
        'tempTestData': []
    }
});

appMixture.PredictionResultModel = Backbone.Model.extend({
    url: "predict"
});
