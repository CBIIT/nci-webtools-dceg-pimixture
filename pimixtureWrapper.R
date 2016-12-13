library(jsonlite)
library(PIMixture)

runCalculation <- function(jsonData) {
    input = fromJSON(jsonData)
    p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "),paste(input$covariates,collapse=" + "),sep=" ~ ")
    result = PIMixture(p.model=p.model,data=input$csvFile)
    toJSON(input, auto_unbox = T)
}
