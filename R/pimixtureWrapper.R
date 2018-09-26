library(jsonlite)
library(PIMixture)

source('R/converting_functions.R')
source('R/TestData.Check.R')

runCalculation <- function(jsonData) {
    input = fromJSON(jsonData)
    csvFile = read.csv(input$filename)
    csvData = csvFile[, input$columns]
    model <- input$model
    design = input$design
    if (length(input$covariatesSelection) == 0) {
        p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "), "1", sep=" ~ ")
    } else {
        p.model <- paste(paste(input$outcomeC,input$outcomeL,input$outcomeR,sep=" + "), input$covariates, sep=" ~ ")
    }
    print(p.model)
    time.interval = 1e-2
    if (length(input$covariatesArr) > 0 || !is.null(input$weightInfo)) {
        data <- data.conversion(data.type=input$covariatesArr, DATA=csvData, wght.info=input$weightInfo)
    } else {
        data <- csvData
    }
    result <-PIMixture(p.model=p.model, data=data, model=model, sample.design=design)
    result$covariatesSelection <- input$covariatesSelection
    result$covariatesArr <- input$covariatesArr
    outputFileName = input$outputRdsFilename
    cat(outputFileName)
    saveRDS(result, outputFileName)
    rownames(result$data.summary) <- result$data.summary$label
    result$data.summary = as.list(as.data.frame(t(result$data.summary[2])))
    result$cum.hazard = list(
      xAxis=as.vector(result$cum.hazard[[1]]),
      yAxis=as.vector(result$cum.hazard[[2]])
    )
    returnValue = toJSON(list(
      cumulative.hazard = result$cum.hazard,
      data.summary = result$data.summary,
      hazard.ratio = result$HR,
      odds.ratio = result$OR,
      regression.coefficient = result$regression.coef,
      model = result$model,
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
    data.type <- model$covariatesArr

    # read test.data from input
    test.data0 <- read.csv(input$testDataFile)
    test.data <- testdata.check(model, test.data0, data.type)
    if (is.null(test.data)) {
        return ("Test Data is not compatible with model!")
    }

    # read time.points from input
    time.points <- input$timePoints
    print(time.points)

    # run prediction function
    predict<-PIMixture.predict(x=model, data=test.data, time.points=time.points)
    exportJson <- toJSON(list(
        predict = predict,
        model = model$model
    ), auto_unbox = T)
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

readFromRDS <- function(jsonData) {
    input = fromJSON(jsonData)
    filename <- input$rdsFile
    model <- readRDS(filename)
    covariatesArr <- model$covariatesSelection
    if (is.null(covariatesArr)) {
        return ("[]")
    } else {
        return (toJSON(covariatesArr))
    }
}