library(jsonlite)
library(PIMixture)

runCalculation <- function(jsonData) {
    input = fromJSON(jsonData)
    csvFile = read.csv(input$filename)
    p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "),paste(input$covariates,collapse=" + "),sep=" ~ ")
    time.interval = 1e-2
    result = PIMixture(p.model=p.model,data=csvFile,time.interval = time.interval)
    rownames(result$data.summary) <- result$data.summary$label
    result$data.summary = as.list(as.data.frame(t(result$data.summary[2])))
    result$cum.hazard = list(
      xAxis=as.vector(result$cum.hazard[[1]]),
      yAxis=as.vector(result$cum.hazard[[2]])
    )
    toJSON(list(
      cumulative.hazard = result$cum.hazard,
      data.summary = result$data.summary,
      hazard.ratio = result$HR,
      odds.ratio = result$OR,
      regression.coefficient = result$regression.coef
    ), auto_unbox = T)
}

runPredict <- function(jsonData) {
    input = fromJSON(jsonData)
    filename=input$filename
    start=input$start
    end=input$end
    inc=input$inc
    time.points=c(start,end,inc)
    data_file <- read.csv(filename, header=TRUE, sep=",", stringsAsFactors=FALSE)
    predict<-PIMixture.predict(x=result, data=data_file, time.points=time.points)

    jsonl =list("predict"=predict)
    exportJson <- toJSON(jsonl)
    return (exportJson)
}
