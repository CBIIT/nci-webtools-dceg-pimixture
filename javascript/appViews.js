
$(function () {
    Number.prototype.countDecimals = function () {
        if (Math.floor(this.valueOf()) === this.valueOf()) return 0;
        return this.toString().split(".")[1].length || 0;
    };
    appMixture.router = new appMixture.Router();
    appMixture.templates = new appMixture.TemplatesModel();
    appMixture.templates.fetch().done(function () {
        appMixture.models.form = new appMixture.FormModel();
        appMixture.models.results = new appMixture.ResultsModel();
        appMixture.models.prediction = new appMixture.PredictionModel();
        appMixture.models.base = new appMixture.BaseModel({
            'form': appMixture.models.form,
            'results': appMixture.models.results
        });
        appMixture.views.base = new appMixture.BaseView({
            model: appMixture.models.base
        });
        appMixture.views.prediction = new appMixture.PredictionView({
            model: appMixture.models.prediction
        });
        appMixture.views.home = new appMixture.HomeView();
        appMixture.views.help = new appMixture.HelpView();
        Backbone.history.start();
    });
});
