library(jsonlite)
library(PIMixture)

runCalculation <- function(jsonData) {
    input = fromJSON(jsonData)
    csvFile = read.csv(input$filename)
    model=tolower(input$model)
    if (length(input$covariatesSelection) == 0) {
        p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "), "1", sep=" ~ ")
    } else {
        p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "),paste(input$covariatesSelection,collapse=" + "),sep=" ~ ")
    }
    time.interval = 1e-2
    result <-PIMixture(p.model=p.model,data=csvFile, model=model)
    outputFileName = input$outputRdsFilename
    cat(outputFileName)
    saveRDS(result, outputFileName)
    rownames(result$data.summary) <- result$data.summary$label
    result$data.summary = as.list(as.data.frame(t(result$data.summary[2])))
    result$cum.hazard = list(
      xAxis=as.vector(result$cum.hazard[[1]]),
      yAxis=as.vector(result$cum.hazard[[2]])
    )
    print ("saving RDS")
    returnValue = toJSON(list(
      cumulative.hazard = result$cum.hazard,
      data.summary = result$data.summary,
      hazard.ratio = result$HR,
      odds.ratio = result$OR,
      regression.coefficient = result$regression.coef,
      Rfile=outputFileName
    ), auto_unbox = T)
    output = returnValue
    filename = input$outputFilename
    fileConn = file(filename)
    writeLines(output,fileConn)
    close(fileConn)
    filename
}

runPredict <- function(jsonData) {
    input <- fromJSON(jsonData)
    # Read fitted model from .rds file
    filename <- input$rdsFile
    model <- readRDS(filename)

    # read test.data from input
    test.data <- input$testData
    # read time.points from input
    time.points <- input$timePoints
    print(time.points)

    # run prediction function
    predict<-PIMixture.predict(x=model, data=test.data, time.points=time.points)
    exportJson <- toJSON(predict)
    return (exportJson)
}

runPredictDummy <- function(jsonData) {
  print("predicting")
    input = fromJSON(jsonData)
    file=input$Rfile
    print(file)
    fit=readRDS(file)
    print("got fit")
    #model<-"C_CIN3PLUS+L_CIN3PLUS+R_CIN3PLUS~RES_HPV16"
    #fit1<-PIMixture(p.model=model,data=bd.data, model="logistic-Weibull")
    test.data<- data.frame(rbind(1,0))
    names(test.data)<- "RES_HPV16"
    time.points=c(0,12,36,60)
    predict<-PIMixture.predict(x=fit, data=test.data, time.points=time.points)
    print("predicted")
    exportJson <- toJSON(predict)
    return (exportJson)
}
