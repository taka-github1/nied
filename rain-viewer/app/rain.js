require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Basemap",
  "esri/layers/ImageryLayer",
  "esri/layers/MapImageLayer",
  "esri/layers/WebTileLayer",
  "esri/rest/support/ImageIdentifyParameters",
  "esri/layers/FeatureLayer",
  "esri/widgets/Expand",
  "esri/widgets/TimeSlider",
  "esri/request",
  "dojo/promise/all"
], (
  Map,
  MapView,
  Basemap,
  ImageryLayer,
  MapImageLayer,
  WebTileLayer,
  ImageIdentifyParameters,
  FeatureLayer,
  Expand,
  TimeSlider,
  esriRequest,
  all
) => {

  /** 
   * 凡例およびポップアップ用の設定リスト
   * legend.html の class="legendDiv_"と対応している
   * 各要素の2番目と3番目は、それぞれポップアップのタイトルと数値に付ける単位
   */
  const legendList = [
    ["rain", "1時間降水量", "mm/h"],
    ["flood", "浸水深", "m"],
    ["Road", "", ""],
    ["Tatemono", "", ""],
    ["R24H", "24時間降水量", "mm"],
    ["R48H", "48時間降水量", "mm"],
    ["R72H", "72時間降水量", "mm"],
    ["ER90M", "1.5時間実効雨量", "mm"],
    ["ER72H", "72時間実効雨量", "mm"]
  ];

  const graphInfos = [
    {
      "id": "0",
      "type": "horizontalLineChart",
      "scenario": "人吉市令和2年7月豪雨",
      "theme": "浸水害",
      "layer": "浸水建物",
      "chartLabel": "件数",
      "StatisticsFields": [
        {
          "title": "0.5m浸水建物件数",
          "layerId": "0",
          "queryField": "日時",
          "graphColor": "yellow",
        },
        {
          "title": "建物件数",
          "layerId": "1",
          "queryField": "",
          "graphColor": "black",
        },
        // {
        //   "title": "3m浸水建物件数",
        //   "layerId": "1",
        //   "field": "ObjectId",
        //   "type": "count"
        // }
      ]
    }
  ];
  let popupTitle = "";
  let popupUnit = "";

  /** 背景地図 */
  /*
  const basemap = new Basemap({
    title: "淡色地図",
    baseLayers: [
      new WebTileLayer({
        urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/pale/{level}/{col}/{row}.png",
        copyright: "国土地理院"
      })
    ],
    thumbnailUrl: "https://cyberjapandata.gsi.go.jp/xyz/pale/12/3637/1612.png"
  });
  */
  const map = new Map({
    basemap: "hybrid"
  });
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [138.836, 37.595],
    zoom: 7,
    popup: {
      dockEnabled: false,
      dockOptions: {
        // Disables the dock button from the popup
        buttonEnabled: false,
        // Ignore the default sizes that trigger responsive docking
        breakpoint: false
      }
    }
  });

  view.ui.add(document.getElementById("titleDiv"), "top-left");

  /**
   * ArcGIS ServerのserviceDescriptionの設定内容からレイヤー選択用のリストを作成する。
   * 「シナリオ名_テーマ名_レイヤー名」という形式であることが必要
   */
  const baseRestURL = "https://maps-dr.bosai.go.jp/webgis/rest/services/";
  const rainRestURL = "https://maps-dr.bosai.go.jp/webgis/rest/services/rain";
  const rainRestOptions = {
    query: {
      f: "json"
    },
    responseType: "json"
  };
  const scenarioSelect = document.getElementById("scenarioSelect");
  const themeSelect = document.getElementById("themeSelect");
  const layerSelect = document.getElementById("layerSelect");


  let selectedGraphInfo = {};
  let graphInstance = null;

  let timeEnabledLayerList = [];
  let timeEnabledLayerObjList = [];
  esriRequest(rainRestURL, rainRestOptions).then(function (response) {
    timeEnabledLayerList = response.data.services.map(rainServce => {
      if (rainServce.type == "ImageServer" || rainServce.type == "MapServer") {
        return setServiceOption(rainServce);
      }
    });
    all(timeEnabledLayerList).then(function (results) {
      results.forEach(function (timeEnabledLayer) {
        //console.log("timeEnabledLayer:", timeEnabledLayer);
        let serviceNames = timeEnabledLayer.serviceDescription.split("_");
        let serviceUrl = timeEnabledLayer.url;
        let scenario = timeEnabledLayerObjList.find(value => value.name === serviceNames[0]);
        if (scenario) {
          //console.log(scenario.data);
          let theme = scenario.data.find(value => value.name === serviceNames[1]);
          if (theme) {
            //console.log("theme.data");
            theme.data.push({ name: serviceNames[2], url: serviceUrl });
          } else {
            //console.log("テーマなし");
            scenario.data.push({ name: serviceNames[1], data: [{ name: serviceNames[2], url: serviceUrl }] });
          }

        } else {
          //console.log("シナリオなし");
          timeEnabledLayerObjList.push({ name: serviceNames[0], data: [{ name: serviceNames[1], data: [{ name: serviceNames[2], url: serviceUrl }] }] });
        }

      });
      timeEnabledLayerObjList.map(scenario => {
        const scenarioOption = document.createElement("option");
        scenarioOption.text = scenario.name;
        scenarioOption.value = scenario.name;
        scenarioSelect.appendChild(scenarioOption);
        //console.log(scenarioOption);
      });

    });
  });
  function setServiceOption(service) {
    return esriRequest(baseRestURL + service.name + "/" + service.type, rainRestOptions).then(function (response) {
      return { serviceDescription: response.data.serviceDescription, url: baseRestURL + service.name + "/" + service.type };
    });
  }

  /** 時間対応のイメージサービスまたはマップサービス */
  let timeEnabledLayer;
  const timeSlider = new TimeSlider({
    container: "timesliderDiv",
    mode: "instant",
    view: view,
    timeVisible: true, // show the time stamps on the timeslider
    loop: false
  });
  let selectedScenario;
  let zoom2layer = true; //そのシナリオで最初に選択したレイヤーのfullExtentにズームする
  scenarioSelect.addEventListener("change", () => {
    //console.log("scenarioSelect.value:", scenarioSelect.value);
    zoom2layer = true;
    if (!scenarioSelect.value) {
      return;
    }
    removeOptions(themeSelect);
    removeOptions(layerSelect);
    selectedScenario = timeEnabledLayerObjList.find(value => value.name === scenarioSelect.value);
    //console.log("selectedScenario:", selectedScenario);
    selectedScenario.data.map(theme => {
      //console.log(theme.name);
      const themeOption = document.createElement("option");
      themeOption.text = theme.name;
      themeOption.value = theme.name;
      themeSelect.appendChild(themeOption);
    });
  });
  themeSelect.addEventListener("change", () => {
    removeOptions(layerSelect);
    //console.log("themeSelect.value:", themeSelect.value);
    let selectedTheme = selectedScenario.data.find(value => value.name === themeSelect.value);
    if (!selectedTheme) {
      return;
    }
    //console.log("selectedTheme:", selectedTheme);
    selectedTheme.data.map(layer => {
      //console.log(layer.name);
      const layerOption = document.createElement("option");
      layerOption.text = layer.name;
      layerOption.value = layer.url;
      layerSelect.appendChild(layerOption);
    });

    //前回のグラフレイヤーを削除
    const oldGraphLayers = map.layers.find(layer => layer.title.startsWith("graph_"));

    if (oldGraphLayers && oldGraphLayers.length > 0) {
      oldGraphLayers.forEach(function (layer) {
        map.remove(layer);
      });
    }

    //グラフ集計の情報を取得
    selectedGraphInfo = graphInfos.find(info => (info.scenario === selectedScenario.name && info.theme === selectedTheme.name));

    if (selectedGraphInfo && selectedGraphInfo.layer) {
      const layerInfo = selectedTheme.data.find(data => (data.name === selectedGraphInfo.layer));
      if (layerInfo && layerInfo.url) {
        selectedGraphInfo["url"] = layerInfo.url;
        selectedGraphInfo.StatisticsFields.forEach(function (statisticsField) {
          statisticsField["url"] = selectedGraphInfo["url"] + "/" + statisticsField.layerId;
          statisticsField["layer"] = new FeatureLayer({
            title: `graph_${statisticsField.title}`,
            url: statisticsField["url"]
          });
        });
      }
    }
    if (timeSlider.timeExtent) {
      graphRedraw(timeSlider.timeExtent.start);
    }
  });
  layerSelect.addEventListener("change", () => {
    document.getElementById("viewDiv").style.cursor = "wait";
    if (timeEnabledLayer) {
      map.remove(timeEnabledLayer);
    }
    if (layerSelect.value === "") {
      return;
    }
    if (layerSelect.value.includes("MapServer")) {
      timeEnabledLayer = new MapImageLayer({
        id: "timeEnabledLayer",
        url: layerSelect.value,
        opacity: 0.6,
        definitionExpression: "after_time = " + afterTime,
        visible: true
      });
    } else if (layerSelect.value.includes("ImageServer")) {
      timeEnabledLayer = new ImageryLayer({
        id: "timeEnabledLayer",
        url: layerSelect.value,
        opacity: 0.6,
        definitionExpression: "after_time = " + afterTime,
        visible: true
      });
    }
    map.add(timeEnabledLayer);
    view.whenLayerView(timeEnabledLayer).then((lv) => {
      document.getElementById("viewDiv").style.cursor = "auto";
      //console.log("timeEnabledLayer.rasterFunctionInfos:", timeEnabledLayer.rasterFunctionInfos[0].name);
      if (zoom2layer) {
        zoom2layer = false;
        view.goTo({
          target: timeEnabledLayer.fullExtent
        }, {
          duration: 1000
        });
      }
      timeSlider.fullTimeExtent = timeEnabledLayer.timeInfo.fullTimeExtent;
      if (timeSlider.timeExtent) {
        if (timeSlider.timeExtent.start < timeSlider.fullTimeExtent.start) {
          timeSlider.timeExtent = { start: timeSlider.fullTimeExtent.start, end: timeSlider.fullTimeExtent.start };
        } else if (timeSlider.timeExtent.start > timeSlider.fullTimeExtent.end) {
          timeSlider.timeExtent = { start: timeSlider.fullTimeExtent.end, end: timeSlider.fullTimeExtent.end };
        }
      }
      timeSlider.stops = {
        interval: timeEnabledLayer.timeInfo.interval
      };
      document.getElementById("timeView").style.display = "block";
      document.getElementById("timeslider_box").style.display = "block";
      timeSlider.watch("timeExtent", (timeExtent) => {
        document.getElementById("timeView").innerHTML = timeExtent.start.toLocaleString('ja-JP');
        if (view.popup.visible) {
          identify4popup(clickedMapPoint);
        }

        //グラフ表示の更新
        graphRedraw(timeExtent.start);
      });
      if (view.popup.visible) {
        identify4popup(clickedMapPoint);
      }
      //凡例の更新
      legendList.forEach(legend => {
        let legendLayerName = "";
        if (timeEnabledLayer.rasterFunctionInfos) {
          legendLayerName = timeEnabledLayer.rasterFunctionInfos[0].name;
        } else {
          legendLayerName = timeEnabledLayer.title;
        }
        if (legend[0] === legendLayerName) {
          popupTitle = legend[1];
          popupUnit = legend[2];
          document.getElementById("legendFrame").contentWindow.document.querySelectorAll(".legendDiv_" + legend[0]).forEach(legendDiv => {
            legendDiv.style.display = "block";
          });
        } else {
          document.getElementById("legendFrame").contentWindow.document.querySelectorAll(".legendDiv_" + legend[0]).forEach(legendDiv => {
            legendDiv.style.display = "none";
          });
        }
      });
    });
  });
  function removeOptions(x) {
    if (x.hasChildNodes()) {
      while (x.childNodes.length > 2) {
        x.removeChild(x.lastChild);
      }
    }
  }

  view.when(function () {
    if (view.widthBreakpoint === "xsmall") {
      legendExpand.visible = false;
      document.getElementById("legendModalButton").style.display = "block";
    } else {
      legendExpand.visible = true;
      document.getElementById("legendModalButton").style.display = "none";
    }
  });

  //現況と予測値の切り替え
  view.ui.add(layerRadioGroup, "top-right");
  view.ui.move("zoom", "top-left");
  let afterTime = 0;
  layerRadioGroup.addEventListener("calciteRadioGroupChange", (event) => {
    //console.log("event.detail:", event.detail);
    afterTime = event.detail;
    timeEnabledLayer.definitionExpression = "after_time = " + afterTime;
    if (view.popup.visible) {
      identify4popup(clickedMapPoint);
    }
  });

  //ポップアップ表示
  let clickedMapPoint;
  view.on("click", function (event) {
    clickedMapPoint = event.mapPoint;
    identify4popup(clickedMapPoint);
  });
  function identify4popup(mapPoint) {
    if (timeEnabledLayer.type === "imagery") {
      let imageIdentifyParams = new ImageIdentifyParameters();
      imageIdentifyParams.geometry = mapPoint;
      imageIdentifyParams.timeExtent = timeSlider.timeExtent;
      imageIdentifyParams.mosaicRule = { where: "after_time = " + afterTime };
      imageIdentifyParams.renderingRule = {}; //response.valueがRGB("236, 236, 138")となるのを回避するため
      const popup = view.popup;
      if (timeEnabledLayer && timeEnabledLayer.visible) {
        timeEnabledLayer.identify(imageIdentifyParams).then(function (response) {
          if (response.value != "NoData") {
            popup.open({
              title: popupTitle + "：" + Math.round(response.value * 10) / 10 + popupUnit
            });
          } else {
            popup.clear();
          }
        });
      }
    }
    if (timeEnabledLayer.type === "map-image") {
      //MapImageLayerの場合のポップアップ設定は未実装
    }
  }

  //グラフの再描画処理
  async function graphRedraw(lastTime) {

    if (graphInstance) {
      graphInstance.destroy();
    }

    const graphCanvas = document.getElementById("graphCanvas");

    if (selectedGraphInfo) {
      // graphExpand.expanded = true;
      // graphExpand.visible = true;

      for (const statisticsField of selectedGraphInfo.StatisticsFields) {
        statisticsField["count"] = 0;
        const query = statisticsField.layer.createQuery();
        if (statisticsField["queryField"] === "") {
          query.where = "1=1";
        } else {
          query.where = `${statisticsField["queryField"]} <= TIMESTAMP '${formatDate(lastTime, "yyyy/MM/dd HH:mm:ss")}'`;
        }
        const count = await statisticsField.layer.queryFeatureCount(query);
        statisticsField["count"] = count;
      }

      var ctx = graphCanvas.getContext('2d');

      const labels = selectedGraphInfo.StatisticsFields.map(field => {
        return field.title;
      });
      const datas = selectedGraphInfo.StatisticsFields.map(field => {
        return field.count;
      });

      const colors = selectedGraphInfo.StatisticsFields.map(field => {
        return field.graphColor;
      });

      graphInstance = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
          labels: labels,
          datasets: [{
            label: selectedGraphInfo.chartLabel,
            data: datas,
            backgroundColor: colors
          }],
        },
        options: {
          title: {
            display: false
          },
          animation: false,
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
          scales: {
            xAxes: [
              {
                ticks: {
                  min: 0
                }
              }
            ],
            yAxes: [
              {
                ticks: {
                  reverse: true
                }
              }
            ]
          },
          tooltips: {
            enabled: true,
            mode: 'index'
          },
          hover: {
            animationDuration: 0
          },
          responsive: true,
          maintainAspectRatio: false
        }
      });
    } else {
      // graphExpand.expanded = false;
      // graphExpand.visible = false;
    }
  }

  //凡例（説明）
  const legendExpand = new Expand({
    visible: false,
    expandIconClass: "esri-icon-legend",
    expandTooltip: "説明",
    expanded: false,
    view: view,
    content: document.getElementById("infoDiv")
  });
  view.ui.add(legendExpand, "top-right");
  view.ui.add(legendModalButton, "top-right");

  //グラフ
  const graphExpand = new Expand({
    expandIconClass: "esri-icon-chart",
    expandTooltip: "グラフ",
    expanded: false,
    view: view,
    content: document.getElementById("graphDiv")
  });
  view.ui.add(graphExpand, "top-left");

  view.watch("widthBreakpoint", function (newVal) {
    if (newVal === "xsmall") {
      legendExpand.visible = false;
      document.getElementById("legendModalButton").style.display = "block";
    } else {
      legendExpand.visible = true;
      document.getElementById("legendModalButton").style.display = "none";
    }
  });

  /** 凡例（スマホ用） */
  document.getElementById("legendModalButton").onclick = () => { document.getElementById("legendModal").active = true; }
  document.getElementById("closeLegendModalButton").onclick = () => { document.getElementById("legendModal").active = false; }

});


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