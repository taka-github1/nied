require([
  "esri/intl",
  "esri/portal/Portal",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap", 
  "esri/layers/FeatureLayer",
  "esri/layers/TileLayer",
  "esri/views/MapView",
  "esri/widgets/Legend",
  "esri/widgets/Expand",
  "esri/widgets/TimeSlider",
  "esri/layers/ImageryLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/tasks/support/Query",
  "esri/layers/support/MosaicRule"
], function (
  intl, Portal, OAuthInfo, identityManager,
  WebMap, FeatureLayer, TileLayer, MapView,
  Legend, Expand, TimeSlider, ImageryLayer,
  GraphicsLayer, Graphic, Query, MosaicRule
) {
  intl.setLocale("us");

  cnt = 0;
  var timeslider_supplyFeturelayer = null;
  var timeslider_supplyViewFeturelayer = null;
  var timeslider_observatoryFeturelayer = null;
  var timeslider_floodHazardImagelayer = null;
  var timeslider_floodRiskImagelayer = null;
  var timeslider_summaryViewGraphicsLayer = null;
  var timeslider_observatoryInundationTable = null;

  var alltime_supplyFeturelayer = null;
  var alltime_supplyViewFeturelayer = null;
  var alltime_observatoryFeturelayer = null;
  var alltime_floodHazardTilelayer = null;
  var alltime_floodRiskTilelayer = null;
  var alltime_summaryViewGraphicsLayer = null;
  var alltime_observatoryInundationTable = null;

  var classificationChart = null;
  var timeSeriesChart = null;
  var inundationDepthChart = null;

  var summary_suspended_ids = [];
  var alltime_summary_suspended_ids = [];

  let highlightSelect;
  var img_url_continue = "image/continue_arrow.png";
  var img_url_up = "image/up_arrow.png";
  var img_url_down = "image/down_arrow.png";

  //&groupID=1ddb8599dc58407f9686ab4093261dee&applicationID=Sa4aa6rGeVfPJwqh&webmapID=ad93c213bfbd4f26aa61c618305e6929

  //パラメータの読み込み
  if (location.search.match(/groupID=(.*?)(&|$)/) == null|| location.search.match(/applicationID=(.*?)(&|$)/) == null || location.search.match(/webmapID=(.*?)(&|$)/) == null) {
    changeEnable(false);
    return;
  } else {
    changeEnable(true);
  }

  var groupId = location.search.match(/groupID=(.*?)(&|$)/)[1];
  var applicationId = location.search.match(/applicationID=(.*?)(&|$)/)[1];
  var webmapId = location.search.match(/webmapID=(.*?)(&|$)/)[1];

  //メインページリンクの変更
  var link = $("#mainpage_link").attr("href");
  $("#mainpage_link").attr("href", link + "?groupID=" + groupId);

  //認証情報の初期化
  var portalUrl =  "https://www.arcgis.com/sharing";
  var info = new OAuthInfo({
    appId: applicationId,
    popup: false
  });

  identityManager.registerOAuthInfos([info]);
  identityManager.getCredential(portalUrl);

  //configの読み込み
  var json_url = "bia_toolkit_settings.json";
  var config = null;
  $.ajaxSetup({async: false});
  $.getJSON(json_url, function(json) {
    config = json;
  });
  $.ajaxSetup({async: true});

  //ストーリー選択の初期化
  var story_id = "1";
  var choise_storyId = document.getElementById("choise_storyId");
  for (var i=0;i<config["stories"].length;i++) {
    var id = config["stories"][i].story_id;
    var label = config["stories"][i].story_label;
    var option = document.createElement("calcite-dropdown-item");
    option.setAttribute('label', id);
    option.innerHTML = label;
    if (i == 0) {
      option.setAttribute('active', true);
    }
    choise_storyId.appendChild(option);
  }

  const timeslider_map = new WebMap({
    portalItem: {
      id: webmapId
    }
  });

  timeslider_summaryViewGraphicsLayer = new GraphicsLayer();
  timeslider_map.add(timeslider_summaryViewGraphicsLayer);
  timeslider_summaryViewGraphicsLayer.visible = false;

  const timeslider_view = new MapView({
    container: "timeslider_mapviewDiv",
    map: timeslider_map,
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false,
        position: "top-left"
      }
    }
  });

  const alltime_map = new WebMap({
    portalItem: {
      id: webmapId
    }
  });

  alltime_summaryViewGraphicsLayer = new GraphicsLayer();
  alltime_map.add(alltime_summaryViewGraphicsLayer);

  const alltime_view = new MapView({
    container: "alltime_mapviewDiv",
    map: alltime_map, 
    popup: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: false,
        breakpoint: false,
        position: "top-left"
      }
    }
  });

  var lgExpand = new Expand({
    view: timeslider_view,
    expanded: false,
    mode : "floating"
  });
  timeslider_view.ui.add(lgExpand, "bottom-right");

  var legend = new Legend({
    view: timeslider_view,
    respectLayerVisibility: true
  });

  lgExpand.content = legend;


  var timeSlider = new TimeSlider({
    container: "timeSliderDiv",
    view: timeslider_view,
    fullTimeExtent: {
      start: new Date(2021, 3, 1, 9, 0),
      end: new Date(2021, 11, 31, 9, 0)
    },
    playRate: 2000,
    mode: "instant",
    stops: {
      interval: {
        value: 1,
        unit: "days"
      }
    }
  });

  timeSlider.watch("values", function(values){

    if (timeslider_floodRiskImagelayer == null || timeslider_floodHazardImagelayer == null ||
        timeslider_supplyViewFeturelayer == null) {
      return;
    }

    refreshTimesliderDiv(values[0]);
    timeslider_view.popup.close();
  });

  timeslider_map.when(async function (layers) {
    timeslider_supplyFeturelayer = layers.layers.find(
      value => value.title == "materials_master");
    timeslider_supplyViewFeturelayer = layers.layers.find(
      value => value.title == "materials_view");
    timeslider_supplyViewFeturelayer.title = "Supply Chain";
    timeslider_observatoryFeturelayer = layers.layers.find(
      value => value.title == "observatory_master");
    timeslider_observatoryFeturelayer.title = "Observatory";
    timeslider_observatoryInundationTable = layers.tables.find(
      value => value.title == "observatory_inundation");
    timeslider_floodHazardImagelayer = layers.layers.find(
      value => value.title == "flood_hazard_image");
    timeslider_floodHazardImagelayer.title = "Flood(Hazard)";
    timeslider_floodRiskImagelayer = layers.layers.find(
      value => value.title == "flood_risk_image");
    timeslider_floodRiskImagelayer.title = "Flood(Risk)";

    timeslider_supplyFeturelayer.visible = false;
    timeslider_supplyViewFeturelayer.visible = true;
    timeslider_observatoryFeturelayer.visible = true;
    timeslider_floodHazardImagelayer.visible = true;
    timeslider_floodRiskImagelayer.visible = false;

    refreshTimesliderDiv(new Date(2021, 3, 1));

    //観測所選択の初期化
    var choise_observatory = document.getElementById("choise_observatory");
    var query = timeslider_observatoryFeturelayer.createQuery();
    query.where = "1=1";
    query.orderByFields = ["BASE_ID"];
    var result = await timeslider_observatoryFeturelayer.queryFeatures(query);
    var observatory = result.features;
    for (var i=0;i<observatory.length;i++) {
      var id = observatory[i]["attributes"]["BASE_ID"];
      var label = observatory[i]["attributes"]["NAME"];
      var option = document.createElement("calcite-dropdown-item");
      option.setAttribute('label', id);
      option.innerHTML = label;
      choise_observatory.appendChild(option);
    }
  });

  alltime_map.when(function (layers) {
    //レイヤー取得
    alltime_supplyFeturelayer = layers.layers.find(
      value => value.title == "materials_master");
    alltime_supplyViewFeturelayer = layers.layers.find(
      value => value.title == "materials_view");
    alltime_observatoryFeturelayer = layers.layers.find(
      value => value.title == "observatory_master");
    alltime_observatoryInundationTable = layers.tables.find(
      value => value.title == "observatory_inundation");
    alltime_floodHazardTilelayer = layers.layers.find(
      value => value.title == "flood_hazard_alltime");
    alltime_floodRiskTilelayer = layers.layers.find(
      value => value.title == "flood_risk_alltime");

    alltime_supplyFeturelayer.visible = false;
    alltime_supplyViewFeturelayer.visible = false;
    alltime_observatoryFeturelayer.visible = true;
    alltime_floodHazardTilelayer.visible = true;
    alltime_floodRiskTilelayer.visible = false;

    alltime_map.reorder(alltime_floodHazardTilelayer, 0);
    alltime_map.reorder(alltime_floodRiskTilelayer, 1);

    getalltimeSuspend_Graphic();
    drawTimeSeriesChart();
    drawInudationDepthChart();
  });

  timeslider_view.when(function() {

    //Suspend Suppy Chainリスト選択
    timeslider_view.whenLayerView(timeslider_supplyViewFeturelayer).then(function(layerView) {
      $('body').on('click', '#inundation-depth-list li', function(e){
        observatory_feature_highlight(e);
      });

      $('body').on('click', '#supply-chain-list li', function(e){

        for (let li of $('li')) {
          li.classList.remove("li_selected");
        }
        e.preventDefault();
        e.target.classList.add("li_selected");
        supplychain_feature_highlight(e);
      });

      function observatory_feature_highlight(event) {
        let id = event.target.id;

        if (event.target.tagName != "LI") {
          id = event.target.parentElement.id;
        }

        if (id == "") return;

        var query = timeslider_observatoryFeturelayer.createQuery();
        query.where = "BASE_ID=" + id;

        timeslider_observatoryFeturelayer.queryFeatures(query).then(function(result) {

          var feature = result.features[0];

          timeslider_view.goTo(
            {
              target: feature.geometry
            },
            {
              duration: 1000,
              easing: "in-out-expo"
            }
          ).catch(function(error){
            if (error.name != "AbortError"){
              console.log(error);
            }
          });
        });
      }

      function supplychain_feature_highlight(event) {

        let value = event.target.id.split(',');
        var query = timeslider_supplyViewFeturelayer.createQuery();
        query.where = "STORY_ID = " + story_id + " AND BASE_ID=" + value[0] + " AND OPERATINGDAY ='" + value[1] + "'";
        timeslider_supplyViewFeturelayer.queryFeatures(query).then(function(result) {
          if (highlightSelect) {
            highlightSelect.remove();
          }

          var feature = result.features[0];

          feature.popupTemplate = timeslider_supplyViewFeturelayer.popupTemplate;
          layerView.view.popup.open({
            features: [feature],
            featureMenuOpen: true,
            updateLocationEnabled: true
          });

          timeslider_view.goTo(
            {
              target: feature.geometry
            },
            {
              duration: 1000,
              easing: "in-out-expo"
            }
          ).catch(function(error){
            if (error.name != "AbortError"){
              console.log(error);
            }
          });
        });
      }
    });
  });

  function refreshTimesliderDiv(date) {
    $('#timeSliderValue').text((date.getMonth()+1) + "/" + date.getDate());
    shinsuiFeaturelayer_query(date);
    shinsuiImagelayer_query(date);
    drawClassificationChart(date);
    suspendlist_query(date);
    getSuspend_Graphic(date);
    observatory_inundation_query(date);
  }

  //設定変更時
  $("#setting").on("calciteDropdownSelect", function(e) {
    //表示モードの切り替え処理
    var showMode = $("#choise_showMode").children();
    for (var i = 0; i < showMode.length; i++) {
      if (showMode[i].active == true) {
        change_showMode(showMode[i].textContent);
      }
    }

    //シナリオIDの切り替え処理
    var showStoryId = $("#choise_storyId").children();
    for (var i = 0; i < showStoryId.length; i++) {
      if (showStoryId[i].active == true) {
        story_id = showStoryId[i].label;
        change_storyId(showStoryId[i].label); 
      }
    }

    //Flood表示モードの切り替え
    var floodMode= $("#choise_floodMode").children();
    for (var i = 0; i < floodMode.length; i++) {
      if (floodMode[i].active == true) {
        change_floodMode(floodMode[i].textContent); 
      }
    }

    //利用可否表示モードの切り替え
    var avalableMode= $("#choise_avalableMode").children();
    for (var i = 0; i < avalableMode.length; i++) {
      if (avalableMode[i].active == true) {
        change_avalableMode(avalableMode[i].textContent); 
      }
    }
  });

  function change_showMode(showMode) {
    if (showMode == "Time Slider") {
      $('#body1Div').addClass("body-active");
      $('#body1Div').removeClass("body-nonactive");
      $('#body2Div').addClass("body-nonactive");
      $('#body2Div').removeClass("body-active");
    } else {
      $('#body1Div').addClass("body-nonactive");
      $('#body1Div').removeClass("body-active");
      $('#body2Div').addClass("body-active");
      $('#body2Div').removeClass("body-nonactive");
    }
  }

  function change_storyId(story_id) {
    //イメージサービスのURL変更
    timeslider_floodHazardImagelayer.url = config["stories"].find(value => value.story_id == Number(story_id)).shinsuiImage_url;
    timeslider_floodRiskImagelayer.url = config["stories"].find(value => value.story_id == Number(story_id)).shinsuiImage_url;

    var id = config["stories"].find(value => value.story_id == Number(story_id)).alltime_shinsui_hazard_id;

    var visible = alltime_floodHazardTilelayer.visible;
    alltime_map.layers.remove(alltime_floodHazardTilelayer);
    alltime_floodHazardTilelayer = new TileLayer({
      portalItem: {
        id: id
      }
    });
    alltime_map.layers.add(alltime_floodHazardTilelayer, 0);
    alltime_floodHazardTilelayer.visible = visible;

    id = config["stories"].find(value => value.story_id == Number(story_id)).alltime_shinsui_risk_id;
    visible = alltime_floodRiskTilelayer.visible;
    alltime_map.layers.remove(alltime_floodRiskTilelayer);
    alltime_floodRiskTilelayer = new TileLayer({
      portalItem: {
        id: id
      }
    });
    alltime_map.layers.add(alltime_floodRiskTilelayer, 0);
    alltime_floodRiskTilelayer.visible = visible;

    refreshTimesliderDiv(timeSlider.values[0]);
    timeslider_view.popup.close();

    drawTimeSeriesChart();
    drawInudationDepthChart();
  }

  function change_floodMode(floodMode){
    if (floodMode == "Flood(Hazard)") {
      timeslider_floodHazardImagelayer.visible = true;
      timeslider_floodRiskImagelayer.visible = false;
      alltime_floodHazardTilelayer.visible = true;
      alltime_floodRiskTilelayer.visible = false;
    } else if (floodMode == "Flood(Risk)") {
      timeslider_floodHazardImagelayer.visible = false;
      timeslider_floodRiskImagelayer.visible = true;
      alltime_floodHazardTilelayer.visible = false;
      alltime_floodRiskTilelayer.visible = true;
    } else {
      timeslider_floodHazardImagelayer.visible = false;
      timeslider_floodRiskImagelayer.visible = false;
      alltime_floodHazardTilelayer.visible = false;
      alltime_floodRiskTilelayer.visible = false;
    }
  }

  function change_avalableMode(avalableMode){
    if (avalableMode == "Summary") {
      timeslider_summaryViewGraphicsLayer.visible = true;
      timeslider_supplyViewFeturelayer.visible = false;
    } else {
      timeslider_summaryViewGraphicsLayer.visible = false;
      timeslider_supplyViewFeturelayer.visible = true;
    }
  }

  //Display Rateのチェック
  $('#check_rate').on('change', function(){
    drawClassificationChart(timeSlider.values[0]);
  });

  //チャートの切り替え
  $('body').on('click', '.tab' , function() {
    $('.is-active').removeClass('is-active');
    $(this).addClass('is-active');
    $('.is-show').removeClass('is-show');
    const index = $(this).index();
    $('.panel').eq(index).addClass('is-show');
  });

  function shinsuiFeaturelayer_query(date){

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    timeslider_supplyViewFeturelayer.definitionExpression = "STORY_ID = " + story_id + "AND OPERATINGDAY = '" + str_date + "'";
  }

  function shinsuiImagelayer_query(date){

    var mr = new MosaicRule({
      where: "NAME='" + formatDate(date, 'yyyyMMdd') + "'"
    }); 
    timeslider_floodRiskImagelayer.mosaicRule = mr;
    timeslider_floodHazardImagelayer.mosaicRule = mr;

  }

  function drawClassificationChart(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_supplyViewFeturelayer.createQuery();

    //稼働のみ
    query.where = "STORY_ID = " + story_id + " AND OPERATINGDAY = '" + str_date + "'";
    query.outFields = [
      "BASE_TYPE,AVAILABLE"
    ];

    query.groupByFieldsForStatistics = "BASE_TYPE,AVAILABLE";
    query.orderByFields = "BASE_TYPE,AVAILABLE";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    timeslider_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      var available_list = {};
      var notavailable_list = {};
      var labels = [];
      var available_count = [];
      var notavailable_count = [];

      var display_rate = false;
      if ($('#check_rate:checked').val() != null) {
        display_rate = true;
      }

      //初期化
      for(var i = 0; i< features.length; i++) {
        var base_type = features[i].attributes["BASE_TYPE"];
        if (labels.indexOf(base_type) == -1) {
          labels.push(base_type);
          available_list[base_type] = 0;
          notavailable_list[base_type] = 0;
        }
      }

      //件数の取得
      for(var i = 0; i< features.length; i++) {
        var base_type = features[i].attributes["BASE_TYPE"];
        var available = features[i].attributes["AVAILABLE"];
        var count = features[i].attributes["カウント"];

        if (available == 0) {
          available_list[base_type] = count;
        } else {
          notavailable_list[base_type] = count;
        }
      }

      available_count = Object.values(available_list);
      notavailable_count = Object.values(notavailable_list);

      //Rateの計算
      if (display_rate == true) {
        for (var i = 0; i< available_count.length; i++) {
          var sum = available_count[i] + notavailable_count[i];
          available_count[i] = Math.floor(100 * available_count[i] / sum);
          notavailable_count[i] = Math.ceil(100 * notavailable_count[i] / sum);
        }
      }

      update_classificationChart(labels, available_count, notavailable_count);

    });

  }

  function update_classificationChart(labels, available_count, notavailable_count){

    var ctx = document.getElementById("classificationChartCanvas").getContext('2d');

    if (classificationChart != null) {
      classificationChart.destroy();
    }

    var display_rate = false;
    if ($('#check_rate:checked').val() != null) {
      display_rate = true;
    }

    var xlabel = "Place";
    var xUnit = "";
    var xStepSize = 10;

    if (display_rate == true) {
      xlabel = "Rate";
      xUnit = "%";
      xStepSize = 50;
    }

    var datasets = [];

    datasets.push({
      data: available_count,
      backgroundColor: "rgba(100,255,150,0.5)"
    });

    datasets.push({
      data: notavailable_count,
      backgroundColor: "rgba(255,0,0,0.5)"
    });

    var yLabel = "";

    classificationChart = new Chart(ctx, {
      type: 'horizontalBar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 20
          }
        },
        legend: {
          display: false
        },
        tooltips: {
          enabled: false
        },
        hover: {
          animationDuration: 0
        },
        animation: {
          duration: 1,
          onComplete: function () {
            var chartInstance = this.chart;
            var ctx = chartInstance.ctx;
            ctx.textAlign = "left";
            ctx.font = "12px Open Sans";
            ctx.fillStyle = "#fff";

            Chart.helpers.each(this.data.datasets.forEach(function (dataset, i) {
              var meta = chartInstance.controller.getDatasetMeta(i);
              Chart.helpers.each(meta.data.forEach(function (bar, index) {


                if(i==0){
                  data = " " + dataset.data[index] + xUnit + " Available";
                  ctx.fillText(data, bar._model.base, bar._model.y+4);
                } else {
                  data = " " + dataset.data[index] + xUnit + " Suspended ";
                  ctx.fillText(data, bar._model.base, bar._model.y+4);
                }
              }),this)
            }),this);
          }
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: true,
              labelString: xlabel,
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              stepSize: xStepSize,
              callback: function(value, index, values){
                return  value
              }
            },
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: "type",
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                if (label == null) {
                  return "No Type"
                } else {
                  return label
                }
              }
            } 
          }]
        },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }


  //Supply Chain Time Transition
  async function drawTimeSeriesChart() {

    //グラフのクリア
    var chartTab = $('#timeSeriesChartTab');
    var cahrtDiv = $('#timeSeriesChartDiv');
    chartTab.empty();
    cahrtDiv.empty();

    var query = alltime_supplyViewFeturelayer.createQuery();

    query.where = "STORY_ID = " + story_id ;
    query.outFields = [
      "BASE_TYPE"
    ];

    query.groupByFieldsForStatistics = "BASE_TYPE";
    query.orderByFields = "BASE_TYPE";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    //Base_type=ALL
    await drawTimeSeriesChart_PerType();

    alltime_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var base_type = features[i].attributes["BASE_TYPE"];
        drawTimeSeriesChart_PerType(base_type);
      }
    });

  }


  //Supply Chain Time Transition
  async function drawTimeSeriesChart_PerType(base_type) {

    var query = alltime_supplyViewFeturelayer.createQuery();

    //Base_type=ALL
    if (base_type == null) {
      query.where = "STORY_ID = " + story_id;
      query.outFields = [
        "OPERATINGDAY,AVAILABLE"
      ];
      query.groupByFieldsForStatistics = "OPERATINGDAY,AVAILABLE";
    } else {
      query.where = "STORY_ID = " + story_id + " AND BASE_TYPE = '" + base_type + "'";
      query.outFields = [
        "BASE_TYPE,OPERATINGDAY,AVAILABLE"
      ];
      query.groupByFieldsForStatistics = "BASE_TYPE,OPERATINGDAY,AVAILABLE";
    }

    query.orderByFields = "OPERATINGDAY,AVAILABLE";
    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    await alltime_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      var available_list = {};
      var notavailable_list = {};
      var labels = [];
      var available_count = [];
      var notavailable_count = [];

      var title = "ALL";
      if (features[0].attributes.hasOwnProperty("BASE_TYPE")) {
        title = features[0].attributes["BASE_TYPE"];
      }

      //初期化
      for(var i = 0; i< features.length; i++) {
        var date = new Date(features[i].attributes["OPERATINGDAY"]);
        var date_txt = formatDate(date, "MM/dd");
        if (labels.indexOf(date_txt) == -1) {
          labels.push(date_txt);
          available_list[date_txt] = 0;
          notavailable_list[date_txt] = 0;
        }
      }

      //件数の取得
      for(var i = 0; i< features.length; i++) {
        var date = new Date(features[i].attributes["OPERATINGDAY"]);
        var date_txt = formatDate(date, "MM/dd");
        var available = features[i].attributes["AVAILABLE"];
        var count = features[i].attributes["カウント"];

        if (available == 0) {
          available_list[date_txt] = count;
        } else {
          notavailable_list[date_txt] = count;
        }
      }

      available_count = Object.values(available_list);
      notavailable_count = Object.values(notavailable_list);

      update_timeSeriesChart(title, labels, available_count, notavailable_count);

    });

  }

  function update_timeSeriesChart(title, labels, available_count, notavailable_count){

    var chartTab = $('#timeSeriesChartTab');
    var cahrtDiv = $('#timeSeriesChartDiv');
    var panel_id = 'timeSeriasePanel_' + title;

    if (title == "ALL") {
      chartTab.append('<li class="tab is-active">' + title + '</li>');
      cahrtDiv.append('<div id="' + panel_id + '" class="panel is-show"/>');
    } else {
      chartTab.append('<li class="tab">' + title + '</li>');
      cahrtDiv.append('<div id="' + panel_id + '" class="panel"/>');
    }

    //Canvas生成
    var canvas_id = 'timeSeriaseChart_' + title;
    element = $('<canvas id="' + canvas_id + '" />');
    $('#' + panel_id).append(element); 

    var ctx = $('#' + canvas_id).get(0).getContext('2d');
    //$('#' + canvas_id).height(120);

    //if (timeSeriesChart != null) {
    //  timeSeriesChart.destroy();
    //}

    var datasets = [];

    datasets.push({
      label: "Available Count",
      data: available_count,
      backgroundColor: "rgba(100,255,150,0.8)"
    });

    datasets.push({
      label: "Suspended Count",
      data: notavailable_count,
      backgroundColor: "rgba(255,0,0,0.8)"
    });

    var yLabel = "";

    timeSeriesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false,
          fontSize: 11,
          fontFamily: "sans-serif",
          text: title
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 0
          }
        },
        legend: {
          display: false
        },
        tooltips: {
          enabled: true
        },
        hover: {
          animationDuration: 0
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: "Time"
            },
            ticks: {
              display: true, 
              callback: function(value, index, values){
                return value
              },
              autoSkip: true,
              maxTicksLimit: 2
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: title,
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                return label
              },
              stepSize: 5
            },
            stacked: true
          }]
        },
        responsive: true,
        //maintainAspectRatio: false
      }
    });
  }

  async function drawInudationDepthChart() {

    var actives = [];
    var list = $("#choise_observatory").children();
    for (var i = 0; i < list.length; i++) {
      if (list[i].active == true) {
        actives.push(list[i].label);
      }
    }

    var query = alltime_observatoryInundationTable.createQuery();

    query.where = "STORY_ID = " + story_id;
    if (actives.length > 0) {
      query.where += " AND BASE_ID IN ('" + actives.join("','") + "')";
    } else {
      query.where += " AND 1<>1";
    }

    query.outFields = [
      "BASE_ID"
    ];
    query.groupByFieldsForStatistics = "BASE_ID";
    query.orderByFields = "BASE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    var response = await alltime_observatoryInundationTable.queryFeatures(query);
    drawInudationDepthPerBaseIdChart(response);
  }

  async function drawInudationDepthPerBaseIdChart(response) {
    var features = response.features;

    var inudation_dataset = [];
    for (var i=0;i<features.length;i++) {
      var base_id = features[i].attributes["BASE_ID"];

      var query = alltime_observatoryInundationTable.createQuery();
      query.where = "STORY_ID = " + story_id + " AND BASE_ID = " + base_id;
      query.outFields = [
        "BASE_ID,OPERATINGDAY,INUNDATION_DEPTH"
      ];
      query.orderByFields = "OPERATINGDAY";

      var response1 = await alltime_observatoryInundationTable.queryFeatures(query);
      var features1 = response1.features;

      var label_list = {};
      var inudation_list = {};
      var label_dataset = null;

      for (var j=0;j<features1.length;j++) {
        var base_id = features1[j].attributes["BASE_ID"];
        var date = new Date(features1[j].attributes["OPERATINGDAY"]);
        var date_txt = formatDate(date, "MM/dd");

        var value = features1[j].attributes["INUNDATION_DEPTH"];
        var value_txt = Math.round(value*10000) / 10000;

        label_list[date] = date_txt;
        inudation_list[date] = value_txt;
      }

      label_dataset = Object.values(label_list);
      inudation_dataset.push({
        id: base_id,
        data: Object.values(inudation_list)
      });

    }
    update_InudationDepthChart(label_dataset, inudation_dataset)
  }


  function update_InudationDepthChart(labels, inudations){

    if (inundationDepthChart != null) {
      inundationDepthChart.destroy();
    }

    var ctx = document.getElementById("inundationDepthChartCanvas");
    var datasets = [];
    var colors = [
      "rgba(255,0,0,1)",
      "rgba(0,0,255,1)",
      "rgba(0,255,0,1)",
      "rgba(255,0,255,1)",
    ];

    for (var i=0;i<inudations.length;i++) {
      datasets.push({
        label: inudations[i].id,
        fill: false,
        borderWidth: 1, 
        data: inudations[i].data,
        pointRadius: 0,
        borderColor: colors[i%colors.length] 
      });  
    }
    var yLabel = "";

    inundationDepthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        title: {
          display: false,
          fontSize: 11,
          fontFamily: "sans-serif",
          text: "Inudation Depth"
        },
        layout: {
          padding: {
            left: 0,
            right: 20,
            top: 20,
            bottom: 0
          }
        },
        legend: {
          display: true
        },
        tooltips: {
          enabled: true,
          mode: 'index'
        },
        hover: {
          animationDuration: 0
        },
        scales: {
          xAxes: [{
            display: true,
            scaleLabel: {
              display: true,
              labelString: "Time"
            },
            ticks: {
              display: true, 
              callback: function(value, index, values){
                return value
              },
              autoSkip: true,
              maxTicksLimit: 2
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: "Inudation Depth(m)",
              fontSize: 12
            },
            ticks: {
              beginAtZero: true,
              userCallback: function(label, index, labels) {
                return label
              },
              //suggestedMax: 5.00,
              suggestedMin: 0.00,
              stepSize: 0.5
            },
            stacked: false
          }]
        },
        responsive: true,
        //maintainAspectRatio: false
      }
    });
  }

  //観測所ごとの浸水深表示
  async function observatory_inundation_query(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();
    var before_date = new Date(date.getTime());
    before_date.setDate(before_date.getDate() - 1);
    var str_before_date = before_date.getFullYear() + "/" + (before_date.getMonth()+1) + "/" + before_date.getDate();

    var actives = [];
    var list = $("#choise_observatory").children();
    for (var i = 0; i < list.length; i++) {
      if (list[i].active == true) {
        actives.push(list[i].label);
      }
    }

    var query = timeslider_observatoryInundationTable.createQuery();

    query.where = "STORY_ID = " + story_id 
    query.where += " AND (OPERATINGDAY = '" + str_date + "' OR OPERATINGDAY = '" + str_before_date + "')";

    if (actives.length > 0) {
      query.where += " AND BASE_ID IN ('" + actives.join("','") + "')";
      timeslider_observatoryFeturelayer.definitionExpression = "BASE_ID IN ('" + actives.join("','") + "')";
      alltime_observatoryFeturelayer.definitionExpression = "BASE_ID IN ('" + actives.join("','") + "')";
    } else {
      query.where += " AND 1<>1";
      timeslider_observatoryFeturelayer.definitionExpression = "1<>1";
      alltime_observatoryFeturelayer.definitionExpression = "1<>1";
    }

    query.outFields = [
      "*"
    ];
    query.orderByFields = "BASE_ID,OPERATINGDAY";
    query.returnGeometry = false;

    var response = await timeslider_observatoryInundationTable.queryFeatures(query);
    var features = response.features;

    var observatory_list = {}
    var depth_list = {}
    var diff_depth_list = {}

    $('#inundation-depth-list').empty();

    //観測所ごとの浸水深を取得
    for(var i = 0; i< features.length; i++) {
      var base_id = features[i].attributes["BASE_ID"];
      var depth = features[i].attributes["INUNDATION_DEPTH"];
      var round_depth = Math.round(depth*100) / 100;
      var operatingday = new Date(features[i].attributes["OPERATINGDAY"]);

      var str_operatingday = operatingday.getFullYear() + "/" + (operatingday.getMonth()+1) + "/" + operatingday.getDate();

      if ((base_id in depth_list) == false) {
        depth_list[base_id] = 0;
        diff_depth_list[base_id] = 0;
      }

      if (str_operatingday == str_date) {
        depth_list[base_id] = round_depth;
        diff_depth_list[base_id] += depth;
      } else {
        diff_depth_list[base_id] -= depth;
      }
    }

    query = timeslider_observatoryFeturelayer.createQuery();

    query.where = "1=1";
    query.outFields = [
      "*"
    ];
    query.orderByFields = "BASE_ID";
    query.returnGeometry = false;

    var response = await timeslider_observatoryFeturelayer.queryFeatures(query);
    var features = response.features;

    //観測所名を取得
    for(var i = 0; i< features.length; i++) {
      var base_id = features[i].attributes["BASE_ID"];
      var name = features[i].attributes["NAME"];
      observatory_list[base_id] = name;
    }

    //観測所ごとの浸水深を表示
    for(var base_id in observatory_list) {
      if(observatory_list.hasOwnProperty(base_id) && depth_list.hasOwnProperty(base_id) && diff_depth_list.hasOwnProperty(base_id)) {
        var name = observatory_list[base_id];
        var depth = depth_list[base_id];
        var diff = diff_depth_list[base_id];

        var list_html = '<li id="' + base_id + '" class="inundation-depth-panel">';

        if (diff == 0) {
          list_html += '<img src="' + img_url_continue + '" class="inundation-depth-image"/>'
        } else if (diff > 0) {
          list_html += '<img src="' + img_url_up + '" class="inundation-depth-image"/>'
        } else if (diff < 0) {
          list_html += '<img src="' + img_url_down + '" class="inundation-depth-image"/>'
        }

        list_html += '<span>OBSERVATORY:　' + base_id + ":" + name + '<br>INUNDATION_DEPTH:　' + depth + '</span>'
        list_html += '</li>';

        $('#inundation-depth-list').append(list_html);
      }
    }
  }

  function suspendlist_query(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_supplyViewFeturelayer.createQuery();

    //不稼働のみ
    query.where = "STORY_ID = " + story_id + " AND OPERATINGDAY = '" + str_date + "' AND AVAILABLE = 1";
    query.outFields = [
      "*"
    ];

    timeslider_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      $('#supply-chain-list').empty();

      for(var i = 0; i< features.length; i++) {
        var base_id = features[i].attributes["BASE_ID"];
        var name = features[i].attributes["NAME"];
        var base_type = features[i].attributes["BASE_TYPE"];
        var depth = features[i].attributes["INUNDATION_DEPTH"];

        depth = Math.round(depth * 100) / 100;

        var operatingday = new Date(features[i].attributes["OPERATINGDAY"]);

        var str_operatingday = operatingday.getFullYear() + "/" + (operatingday.getMonth()+1) + "/" + operatingday.getDate();

        if (base_type == null) {
          base_type = "No Type";
        }
        $('#supply-chain-list').append('<li id="' + base_id + ',' + str_operatingday + '">SuppyChain:' + base_id + ' ' + name + '<br>TYPE:' + base_type + '<br/>INUNDATION_DEPTH:' + depth + '</li>');
      }
    });
  }

  function getSuspend_Graphic(date) {

    var str_date = date.getFullYear() + "/" + (date.getMonth()+1) + "/" + date.getDate();

    var query = timeslider_supplyViewFeturelayer.createQuery();
    //不稼働のみ
    query.where = "STORY_ID = " + story_id + " AND OPERATINGDAY <= '" + str_date + "' AND AVAILABLE = 1";
    query.outFields = [
      "BASE_ID"
    ];
    query.returnGeometry = false;

    query.groupByFieldsForStatistics = "BASE_ID";
    query.orderByFields = "BASE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    timeslider_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      summary_suspended_ids = [];

      for(var i = 0; i< features.length; i++) {
        var base_id = features[i].attributes["BASE_ID"];
        var count = features[i].attributes["カウント"];
        summary_suspended_ids[base_id] = count;
      }
      summary_notavailable_addgraphic();
    });
  }

  function summary_notavailable_addgraphic(){

    var query = timeslider_supplyFeturelayer.createQuery();
    query.where = "1=1";
    query.outFields = ["BASE_ID, NAME"];

    timeslider_supplyFeturelayer.queryFeatures(query)
      .then(function(response){

      timeslider_summaryViewGraphicsLayer.removeAll();

      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var base_id = features[i].attributes["BASE_ID"];

        var graphic = features[i];
        graphic.symbol = {
          type: "simple-marker",
          color: "green",
          size: "12px",
          style: "circle",
        };

        var suspended_ids = Object.keys(summary_suspended_ids);

        if (suspended_ids.length != 0 && suspended_ids.indexOf(base_id) == -1) {
          graphic.attributes["COUNT"] = summary_suspended_ids[base_id];

          if (summary_suspended_ids[base_id] > 90) { 
            graphic.symbol.color = "red";
          } else if (summary_suspended_ids[base_id] > 60) { 
            graphic.symbol.color = "orange";
          } else if (summary_suspended_ids[base_id] > 30) { 
            graphic.symbol.color = "yellow";
          } else { 
            graphic.symbol.color = "green";
          }             
        } else {
          graphic.attributes["COUNT"] = 0;
        }

        graphic.popupTemplate = {
          title: "{NAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "BASE_ID",
                  label: "BASE_ID"
                },
                {
                  fieldName: "NAME",
                  label: "NAME"
                },
                {
                  fieldName: "COUNT",
                  label: "Suspend Days"
                }
              ]
            }
          ]
        };

        timeslider_summaryViewGraphicsLayer.add(graphic);
      }
    });
  }

  function getalltimeSuspend_Graphic() {

    var query = alltime_supplyViewFeturelayer.createQuery();

    //不稼働のみ
    query.where = "STORY_ID = " + story_id + " AND AVAILABLE = 1";
    query.outFields = [
      "BASE_ID"
    ];
    query.returnGeometry = false;

    query.groupByFieldsForStatistics = "BASE_ID";
    query.orderByFields = "BASE_ID";

    query.outStatistics = [
      {
        statisticType: "count",
        onStatisticField: "ObjectId",
        outStatisticFieldName: "カウント"
      }
    ]

    alltime_supplyViewFeturelayer.queryFeatures(query)
      .then(function(response){
      var features = response.features;

      alltime_summary_suspended_ids = {};

      for(var i = 0; i< features.length; i++) {
        var base_id = features[i].attributes["BASE_ID"];
        var count = features[i].attributes["カウント"];
        alltime_summary_suspended_ids[base_id] = count;
      }

      alltime_summary_notavailable_addgraphic();
    });
  }

  function alltime_summary_notavailable_addgraphic(){

    var query = alltime_supplyFeturelayer.createQuery();
    query.where = "1=1";
    query.outFields = ["BASE_ID, NAME"];

    alltime_supplyFeturelayer.queryFeatures(query)
      .then(function(response){

      alltime_summaryViewGraphicsLayer.removeAll();

      var features = response.features;

      for(var i = 0; i< features.length; i++) {
        var base_id = features[i].attributes["BASE_ID"];

        var graphic = features[i];
        graphic.symbol = {
          type: "simple-marker",
          color: "green",
          size: "12px",
          style: "circle",
        };

        var suspended_ids = Object.keys(alltime_summary_suspended_ids);

        if (suspended_ids.length != 0 && suspended_ids.indexOf(base_id) == -1) {
          graphic.attributes["COUNT"] = alltime_summary_suspended_ids[base_id];

          if (alltime_summary_suspended_ids[base_id] > 90) { 
            graphic.symbol.color = "red";
          } else if (alltime_summary_suspended_ids[base_id] > 60) { 
            graphic.symbol.color = "orange";
          } else if (alltime_summary_suspended_ids[base_id] > 30) { 
            graphic.symbol.color = "yellow";
          } else { 
            graphic.symbol.color = "green";
          }             
        } else {
          graphic.attributes["COUNT"] = 0;
        }

        graphic.popupTemplate = {
          title: "{NAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                {
                  fieldName: "BASE_ID",
                  label: "BASE_ID"
                },
                {
                  fieldName: "NAME",
                  label: "NAME"
                },
                {
                  fieldName: "COUNT",
                  label: "Suspend Days"
                }
              ]
            }
          ]
        };

        alltime_summaryViewGraphicsLayer.add(graphic);
      }
    });
  }

  function changeEnable(enable) {
    if (enable) {
      $("#mainDiv").show();
      $("#disableDiv").hide();
    } else {
      $("#mainDiv").hide();
      $("#disableDiv").show();
    }
  }

  function formatDate(date, format) {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
    return format;
  }
});


